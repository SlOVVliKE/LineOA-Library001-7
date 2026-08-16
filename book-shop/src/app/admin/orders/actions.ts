'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { drainNotificationsSafely } from '@/lib/line/notify'

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
 * สร้างแถว payments ขึ้นมาก่อนเพื่อให้ประวัติการเงินไม่ขาดตอน
 * แล้วค่อยเดินเส้นทางเดียวกับการยืนยันสลิปปกติ ตัวเลขในรายงานจึงตรงกัน
 */
export async function confirmPaidWithoutSlip(
  orderId: string,
  note: string
): Promise<OrderActionState> {
  const user = await requirePermission('payment.verify')
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('status, total, deposit_amount, balance_due')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { ok: false, message: 'ไม่พบคำสั่งซื้อ' }

  // ยอมให้เฉพาะออเดอร์ที่ยังไม่ได้ตัดสต็อก กันกดซ้ำจนตัดสต็อกสองรอบ
  const isBalance = order.status === 'awaiting_balance'
  if (!isBalance && order.status !== 'pending_payment' && order.status !== 'preorder_waiting') {
    return { ok: false, message: 'ออเดอร์นี้ผ่านขั้นตอนรับเงินไปแล้ว' }
  }

  const amount = isBalance
    ? Number(order.balance_due ?? 0)
    : Number(order.deposit_amount ?? order.total)

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

  const { error: rpcError } = isBalance
    ? await supabase.rpc('fn_confirm_balance_paid', { p_order_id: orderId, p_created_by: user.id })
    : await supabase.rpc('fn_confirm_order_paid', { p_order_id: orderId, p_created_by: user.id })
  if (rpcError) return { ok: false, message: rpcError.message }

  await drainNotificationsSafely()

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/preorders')
  revalidatePath('/admin')
  return { ok: true, message: 'บันทึกการรับเงินแล้ว ตัดสต็อกและออกใบเสร็จเรียบร้อย' }
}

const shipSchema = z.object({
  order_id: z.string().uuid(),
  carrier: z.enum(['flash', 'jnt']),
  tracking_no: z.string().min(4, 'เลขพัสดุสั้นเกินไป'),
  actual_cost: z.coerce.number().min(0).optional(),
})

/**
 * บันทึกการจัดส่ง
 *
 * ตอนนี้กรอกเลขพัสดุเอง เพราะยังไม่มี API key ของ Flash/J&T
 * เมื่อได้ credential แล้วให้เรียก adapter ใน lib/shipping แทนตรงนี้
 * โครงสร้างตาราง shipments รองรับไว้หมดแล้ว
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

  const { error: shipError } = await supabase.from('shipments').insert({
    order_id,
    carrier_id: carrierRow.id,
    tracking_no,
    merchant_ref: `${order_id}-1`,
    actual_cost: actual_cost ?? null,
    status: 'created',
  })
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
