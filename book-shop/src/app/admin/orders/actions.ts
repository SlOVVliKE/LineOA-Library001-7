'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { drainNotificationsSafely } from '@/lib/line/notify'
import { many, one } from '@/lib/embed'
import {
  shippopAdapter, listShippopQuotes, isShippopConfigured, isShippopSandbox,
} from '@/lib/shipping/shippop'
import type { CreateShipmentInput } from '@/lib/shipping/types'

export type OrderActionState = { ok: boolean; message?: string }

/**
 * ยืนยันการชำระเงิน
 *
 * งานหนักอยู่ในฟังก์ชัน Postgres `fn_confirm_order_paid` ซึ่งทำใน transaction เดียว:
 *   ตัดสต็อกแบบ FIFO → ล็อกต้นทุนลง order_items → รวม COGS → ออกใบเสร็จ → ปลดการจอง
 * ถ้าสต็อกไม่พอ ฟังก์ชันจะ raise แล้วย้อนคืนทั้งหมด ไม่มีทางค้างครึ่งทาง
 */
export async function verifyPayment(
  paymentId: string,
  orderId: string,
  approve: boolean
): Promise<OrderActionState> {
  const user = await requirePermission('payment.verify')
  const supabase = await createClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('purpose')
    .eq('id', paymentId)
    .maybeSingle()

  if (!approve) {
    const { error } = await supabase
      .from('payments')
      .update({
        verify_status: 'rejected',
        verified_at: new Date().toISOString(),
        verified_by: user.id,
      })
      .eq('id', paymentId)
    if (error) return { ok: false, message: error.message }

    revalidatePath(`/admin/orders/${orderId}`)
    return { ok: true, message: 'ปฏิเสธสลิปแล้ว' }
  }

  // สลิปของ "ส่วนที่เหลือ" ไม่ต้องตัดสต็อกอีก เพราะตัดไปแล้วตอนจ่ายของตามคิว
  const isBalance = payment?.purpose === 'balance'
  const { error: rpcError } = isBalance
    ? await supabase.rpc('fn_confirm_balance_paid', {
        p_order_id: orderId,
        p_created_by: user.id,
      })
    : await supabase.rpc('fn_confirm_order_paid', {
        p_order_id: orderId,
        p_created_by: user.id,
      })
  if (rpcError) return { ok: false, message: rpcError.message }

  const { error } = await supabase
    .from('payments')
    .update({
      verify_status: 'manual_verified',
      verified_at: new Date().toISOString(),
      verified_by: user.id,
    })
    .eq('id', paymentId)
  if (error) return { ok: false, message: error.message }

  // trigger ในฐานข้อมูลใส่ข้อความลงคิวไว้แล้ว ตรงนี้แค่ส่งออกทันทีไม่ต้องรอ cron
  await drainNotificationsSafely()

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/preorders')
  revalidatePath('/admin')
  return {
    ok: true,
    message: isBalance
      ? 'รับชำระส่วนที่เหลือแล้ว พร้อมจัดส่ง'
      : 'ยืนยันการชำระเงิน ตัดสต็อก และออกใบเสร็จเรียบร้อย',
  }
}

/**
 * ยืนยันการชำระเงินทั้งที่ลูกค้าไม่ได้ส่งสลิป
 *
 * เกิดขึ้นจริงบ่อย: ลูกค้าโอนแล้วทักมาในแชทว่า "โอนแล้วนะ" แต่ไม่กดอัปโหลด
 * หรือจ่ายเงินสดหน้าร้าน/ที่งานอีเวนต์ ถ้าไม่มีทางนี้ ออเดอร์จะค้าง
 * "รอชำระเงิน" ตลอดไป ตัดสต็อกไม่ได้ ออกใบเสร็จไม่ได้
 *
 * ลำดับสำคัญมาก: เรียก RPC ให้ผ่านก่อน แล้วค่อยบันทึกแถว payments
 * ถ้าบันทึก payments ก่อน แล้ว RPC ปฏิเสธ (เช่นแอดมินเผลอกดซ้ำ)
 * แถว payments จะค้างอยู่โดยไม่มีอะไรลบให้ เพราะสองคำสั่งนี้อยู่คนละ transaction
 * ผลคือประวัติการเงินมีรายการรับเงินซ้ำทั้งที่รับจริงครั้งเดียว
 */
export async function confirmPaidWithoutSlip(
  orderId: string,
  note: string
): Promise<OrderActionState> {
  const user = await requirePermission('payment.verify')
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('status, order_type, total, deposit_amount, balance_due, payments(purpose, verify_status)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { ok: false, message: 'ไม่พบคำสั่งซื้อ' }

  const isBalance = order.status === 'awaiting_balance'

  // ด่านที่ 1: สถานะต้องยังอยู่ในขั้นตอนรับเงิน
  if (!isBalance && order.status !== 'pending_payment') {
    return { ok: false, message: 'ออเดอร์นี้ผ่านขั้นตอนรับเงินไปแล้ว' }
  }

  // ด่านที่ 2: ต้องไม่มีเงินก้อนเดียวกันที่ยืนยันไปแล้ว
  // สั่งจองที่จ่ายแล้วจะค้างสถานะ preorder_waiting รอของเข้า ซึ่งมองจากสถานะอย่างเดียว
  // แยกไม่ออกจากสั่งจองที่ยังไม่จ่าย ต้องดูที่แถว payments ถึงจะรู้
  const stage = isBalance ? 'balance' : 'initial'
  const alreadyPaid = many<{ purpose: string; verify_status: string }>(order.payments).some(
    (p) =>
      (p.verify_status === 'manual_verified' || p.verify_status === 'auto_verified') &&
      (stage === 'balance' ? p.purpose === 'balance' : p.purpose !== 'balance')
  )
  if (alreadyPaid) {
    return { ok: false, message: 'รับเงินก้อนนี้ไปแล้ว ดูรายการในส่วนการชำระเงิน' }
  }

  const amount = isBalance
    ? Number(order.balance_due ?? 0)
    : Number(order.deposit_amount ?? order.total)

  // ให้ฐานข้อมูลตัดสินก่อนว่าเปลี่ยนสถานะได้ไหม ค่อยบันทึกหลักฐานการรับเงิน
  const { error: rpcError } = isBalance
    ? await supabase.rpc('fn_confirm_balance_paid', { p_order_id: orderId, p_created_by: user.id })
    : await supabase.rpc('fn_confirm_order_paid', { p_order_id: orderId, p_created_by: user.id })
  if (rpcError) return { ok: false, message: rpcError.message }

  const { error: insertError } = await supabase.from('payments').insert({
    order_id: orderId,
    method: 'bank_transfer_slip',
    purpose: isBalance ? 'balance' : order.deposit_amount != null ? 'deposit' : 'full',
    amount,
    slip_url: null,
    verify_status: 'manual_verified',
    verified_at: new Date().toISOString(),
    verified_by: user.id,
    // เก็บเหตุผลไว้ให้ตรวจสอบย้อนหลังได้ว่าใครยืนยันโดยไม่มีหลักฐานสลิป
    verify_payload: {
      source: 'manual_no_slip',
      note: note.trim() || null,
      confirmed_by: user.id,
    },
  })
  if (insertError) return { ok: false, message: insertError.message }

  await drainNotificationsSafely()

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/preorders')
  revalidatePath('/admin')
  // สั่งจองที่จ่ายเงินแล้วยังไม่ได้ตัดสต็อกและยังไม่ออกใบเสร็จ ต้องรอของเข้าก่อน
  // ถ้าบอกว่า "ตัดสต็อกและออกใบเสร็จเรียบร้อย" แอดมินจะเข้าใจผิดว่าพร้อมแพ็กส่งได้เลย
  const isPreorderWaiting = !isBalance && order.order_type === 'preorder'
  return {
    ok: true,
    message: isPreorderWaiting
      ? 'บันทึกการรับเงินแล้ว ออเดอร์เข้าคิวรอของ — ระบบจะจ่ายของและออกใบเสร็จให้เองตอนกดรับสินค้าเข้า'
      : 'บันทึกการรับเงินแล้ว ตัดสต็อกและออกใบเสร็จเรียบร้อย',
  }
}

const shipSchema = z.object({
  order_id: z.string().uuid(),
  carrier: z.enum(['flash', 'jnt', 'shippop']),
  tracking_no: z.string().min(4, 'เลขพัสดุสั้นเกินไป'),
  actual_cost: z.coerce.number().min(0).optional(),
})

/**
 * บันทึกการจัดส่ง
 *
 * Flash/J&T ยังกรอกเลขพัสดุเอง (ยังไม่มี API key ของสองเจ้านี้)
 * ส่วน ShipPop ดึงเลขอัตโนมัติได้แล้วผ่าน bookShippopShipment() ด้านล่าง
 * ซึ่งเขียนแถว shipments ไว้ก่อนแล้ว ตรงนี้จึงต้อง upsert ไม่ใช่ insert
 */
export async function markShipped(
  _prev: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  await requirePermission('order.ship')

  const parsed = shipSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }
  }
  const { order_id, carrier, tracking_no, actual_cost } = parsed.data

  const supabase = await createClient()

  const { data: carrierRow } = await supabase
    .from('carriers')
    .select('id')
    .eq('code', carrier)
    .maybeSingle()

  if (!carrierRow) return { ok: false, message: 'ไม่พบขนส่งที่เลือก' }

  // upsert เพราะถ้าจองผ่าน ShipPop มาก่อน แถวนี้มีอยู่แล้ว (merchant_ref เป็น unique)
  // insert ตรงๆ จะชนคีย์ซ้ำ และเราไม่อยากได้พัสดุสองแถวต่อหนึ่งออเดอร์
  const { error: shipError } = await supabase.from('shipments').upsert(
    {
      order_id,
      carrier_id: carrierRow.id,
      tracking_no,
      merchant_ref: `${order_id}-1`,
      actual_cost: actual_cost ?? null,
      status: 'created',
    },
    { onConflict: 'merchant_ref' }
  )
  if (shipError) return { ok: false, message: shipError.message }

  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'shipped',
      shipped_at: new Date().toISOString(),
      shipping_actual_cost: actual_cost ?? null,
    })
    .eq('id', order_id)
  if (orderError) return { ok: false, message: orderError.message }

  await drainNotificationsSafely()

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${order_id}`)
  return { ok: true, message: 'บันทึกการจัดส่งแล้ว' }
}

export async function cancelOrder(orderId: string): Promise<OrderActionState> {
  await requirePermission('order.read')
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { ok: false, message: 'ไม่พบคำสั่งซื้อ' }
  if (order.status !== 'pending_payment' && order.status !== 'preorder_waiting') {
    return {
      ok: false,
      message: 'ยกเลิกได้เฉพาะออเดอร์ที่ยังไม่ได้ตัดสต็อก — ถ้าต้องคืนของให้ใช้เมนูปรับสต็อก',
    }
  }

  await supabase.from('stock_reservations').delete().eq('order_id', orderId)
  const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
  if (error) return { ok: false, message: error.message }

  await drainNotificationsSafely()

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  return { ok: true, message: 'ยกเลิกคำสั่งซื้อแล้ว' }
}

/** สร้าง signed URL อายุสั้นสำหรับดูสลิป (bucket เป็นแบบปิด) */
export async function getSlipUrl(path: string): Promise<string | null> {
  await requirePermission('payment.verify')
  const supabase = await createClient()
  const { data } = await supabase.storage.from('slips').createSignedUrl(path, 300)
  return data?.signedUrl ?? null
}

/* ---------------------------------------------------------------------------
 * ShipPop — ดึงเลขพัสดุอัตโนมัติ
 * ------------------------------------------------------------------------- */

/** น้ำหนักกล่อง/ซองที่บวกเพิ่มจากน้ำหนักหนังสือรวม */
const PACKAGING_GRAMS = 100

/**
 * ประกอบข้อมูลที่ ShipPop ต้องใช้จากออเดอร์หนึ่งใบ
 *
 * น้ำหนักคิดจาก books.weight_grams (มีค่า default 300g ต่อเล่มอยู่แล้ว) คูณจำนวน
 * แล้วบวกน้ำหนักกล่อง — ถ้าแจ้งน้อยกว่าจริง ขนส่งจะเรียกเก็บส่วนต่างทีหลัง
 */
async function buildShipmentInput(orderId: string) {
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_no, shipping_address, cod_amount, payment_type, order_items(qty, title_snapshot, books(weight_grams))')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { error: 'ไม่พบคำสั่งซื้อ' as const }

  const addr = (order.shipping_address ?? {}) as Record<string, string | null>
  if (!addr.line1 || !addr.province || !addr.postcode) {
    return { error: 'ที่อยู่จัดส่งไม่ครบ (ต้องมีบ้านเลขที่ จังหวัด และรหัสไปรษณีย์)' as const }
  }

  const items = many<{
    qty: number
    title_snapshot: string
    books: { weight_grams: number } | { weight_grams: number }[] | null
  }>(order.order_items)

  const weightGrams = items.reduce((sum, item) => {
    const book = one<{ weight_grams: number }>(item.books)
    return sum + item.qty * (book?.weight_grams ?? 300)
  }, PACKAGING_GRAMS)

  const titles = items.map((i) => i.title_snapshot).join(', ')

  return {
    input: {
      merchantRef: `${orderId}-1`,
      orderNo: order.order_no as string,
      recipientName: addr.recipient_name || 'ไม่ระบุชื่อ',
      recipientPhone: addr.phone || '',
      address: {
        line1: addr.line1,
        subdistrict: addr.subdistrict ?? null,
        district: addr.district ?? null,
        province: addr.province,
        postcode: addr.postcode,
      },
      weightGrams,
      // COD ส่งให้ ShipPop เก็บเงินปลายทางเฉพาะออเดอร์ที่เป็น cod จริงเท่านั้น
      codAmount: order.payment_type === 'cod' ? Number(order.cod_amount) : undefined,
      itemDescription: titles.slice(0, 100) || 'หนังสือ',
    } satisfies CreateShipmentInput,
  }
}

export type ShippopQuoteState = {
  ok: boolean
  message?: string
  quotes?: { courierCode: string; courierName: string; price: number; deliveryTime: string | null }[]
}

/**
 * เช็คราคาจากทุกขนส่งที่ปลายทางนี้ใช้ได้
 * ไม่ผูกมัดอะไร ไม่เสียเงิน — เรียกกี่ครั้งก็ได้
 */
export async function quoteShippopRates(orderId: string): Promise<ShippopQuoteState> {
  await requirePermission('order.ship')

  if (!isShippopConfigured()) {
    return { ok: false, message: 'ยังไม่ได้ตั้ง SHIPPOP_API_KEY ใน .env.local' }
  }

  const built = await buildShipmentInput(orderId)
  if ('error' in built) return { ok: false, message: built.error }

  try {
    const quotes = await listShippopQuotes(built.input)
    if (!quotes.length) return { ok: false, message: 'ShipPop ไม่มีขนส่งที่ส่งปลายทางนี้ได้' }
    return { ok: true, quotes: quotes.sort((a, b) => a.price - b.price) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'เช็คราคาไม่สำเร็จ' }
  }
}

export type ShippopBookState = OrderActionState & { trackingNo?: string; cost?: number }

/**
 * จองพัสดุจริงกับ ShipPop แล้วบันทึกลงตาราง shipments
 *
 * **ขั้นนี้เสียเงินจริงบน production** (/confirm/ ตัดเครดิต) — บน sandbox ไม่เสีย
 *
 * กันจองซ้ำด้วยการเช็ค merchant_ref ก่อนเสมอ: ถ้ามีแถวที่มีเลขพัสดุอยู่แล้ว
 * จะคืนเลขเดิมกลับไปเฉยๆ ไม่ยิง API ซ้ำ เพราะ API อาจ timeout ทั้งที่จองสำเร็จ
 * แล้วการกดซ้ำจะได้พัสดุสองใบและถูกเรียกเก็บสองครั้ง
 */
export async function bookShippopShipment(
  orderId: string,
  courierCode: string
): Promise<ShippopBookState> {
  await requirePermission('order.ship')

  if (!isShippopConfigured()) {
    return { ok: false, message: 'ยังไม่ได้ตั้ง SHIPPOP_API_KEY ใน .env.local' }
  }
  if (!courierCode) return { ok: false, message: 'ยังไม่ได้เลือกขนส่ง' }

  const supabase = await createClient()
  const merchantRef = `${orderId}-1`

  const { data: existing } = await supabase
    .from('shipments')
    .select('tracking_no')
    .eq('merchant_ref', merchantRef)
    .maybeSingle()

  if (existing?.tracking_no) {
    return {
      ok: true,
      trackingNo: existing.tracking_no as string,
      message: 'ออเดอร์นี้จองไว้แล้ว ใช้เลขเดิม (ไม่ได้จองซ้ำ)',
    }
  }

  const built = await buildShipmentInput(orderId)
  if ('error' in built) return { ok: false, message: built.error }

  const { data: carrierRow } = await supabase
    .from('carriers')
    .select('id')
    .eq('code', 'shippop')
    .maybeSingle()

  if (!carrierRow) return { ok: false, message: 'ยังไม่มีขนส่ง shippop ในฐานข้อมูล (ยังไม่ได้รัน migration 0027)' }

  let result
  try {
    result = await shippopAdapter.createShipment({ ...built.input, courierCode })
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'จองพัสดุไม่สำเร็จ' }
  }

  // จองสำเร็จแล้ว ถ้าเขียนฐานข้อมูลพลาดตรงนี้ พัสดุจะมีอยู่จริงแต่เราไม่รู้เลข
  // จึงคืนเลขพัสดุกลับไปพร้อมข้อความเตือนให้แอดมินกรอกเอง ไม่กลืนเงียบ
  const { error: shipError } = await supabase.from('shipments').upsert(
    {
      order_id: orderId,
      carrier_id: carrierRow.id,
      tracking_no: result.trackingNo,
      carrier_order_id: result.carrierOrderId,
      merchant_ref: merchantRef,
      label_url: result.labelUrl,
      declared_weight_grams: built.input.weightGrams,
      actual_cost: result.cost || null,
      cod_amount: built.input.codAmount ?? 0,
      status: 'created',
      raw_response: result as unknown as Record<string, unknown>,
    },
    { onConflict: 'merchant_ref' }
  )

  if (shipError) {
    return {
      ok: false,
      trackingNo: result.trackingNo,
      message: `จองสำเร็จได้เลข ${result.trackingNo} แต่บันทึกลงฐานข้อมูลไม่ผ่าน (${shipError.message}) — กรอกเลขนี้ด้วยมือแล้วกดบันทึก`,
    }
  }

  revalidatePath(`/admin/orders/${orderId}`)
  return {
    ok: true,
    trackingNo: result.trackingNo,
    cost: result.cost,
    message: `ได้เลขพัสดุแล้ว${isShippopSandbox() ? ' (sandbox — ยังไม่ใช่พัสดุจริง)' : ''}`,
  }
}
