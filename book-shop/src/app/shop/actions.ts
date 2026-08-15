'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCustomer, getOrCreateCartId } from '@/lib/customer/session'
import { verifySlipBase64, isSlip2GoConfigured } from '@/lib/payment/slip2go'
import { drainNotificationsSafely } from '@/lib/line/notify'

export type ShopState = { ok: boolean; message?: string }

// ---------------- ตะกร้า ----------------

export async function addToCart(bookId: string, qty = 1): Promise<ShopState> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, message: 'กรุณาเข้าสู่ระบบก่อน' }

  const supabase = await createClient()
  const cartId = await getOrCreateCartId(customer.id)

  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, qty')
    .eq('cart_id', cartId)
    .eq('book_id', bookId)
    .maybeSingle()

  // เช็คว่ามีของพอไหมก่อนใส่ตะกร้า (เช็คอีกทีตอน checkout)
  const { data: stock } = await supabase
    .from('v_public_stock')
    .select('available_to_sell')
    .eq('book_id', bookId)
    .maybeSingle()

  const { data: book } = await supabase
    .from('books')
    .select('stock_mode')
    .eq('id', bookId)
    .maybeSingle()

  const wanted = (existing?.qty ?? 0) + qty
  const isPreorder = book?.stock_mode !== 'stock'

  if (!isPreorder && wanted > Number(stock?.available_to_sell ?? 0)) {
    return { ok: false, message: `มีของไม่พอ เหลือ ${stock?.available_to_sell ?? 0} เล่ม` }
  }

  const { error } = existing
    ? await supabase.from('cart_items').update({ qty: wanted }).eq('id', existing.id)
    : await supabase.from('cart_items').insert({ cart_id: cartId, book_id: bookId, qty })

  if (error) return { ok: false, message: error.message }

  revalidatePath('/shop/cart')
  revalidatePath('/shop', 'layout')
  return { ok: true, message: 'ใส่ตะกร้าแล้ว' }
}

export async function updateCartItem(itemId: string, qty: number): Promise<ShopState> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, message: 'กรุณาเข้าสู่ระบบก่อน' }

  const supabase = await createClient()
  const { error } =
    qty <= 0
      ? await supabase.from('cart_items').delete().eq('id', itemId)
      : await supabase.from('cart_items').update({ qty }).eq('id', itemId)

  if (error) return { ok: false, message: error.message }
  revalidatePath('/shop/cart')
  revalidatePath('/shop', 'layout')
  return { ok: true }
}

// ---------------- สร้างคำสั่งซื้อ ----------------

const addressSchema = z.object({
  recipient_name: z.string().min(1, 'ต้องระบุชื่อผู้รับ'),
  phone: z.string().min(9, 'เบอร์โทรไม่ถูกต้อง'),
  line1: z.string().min(1, 'ต้องระบุที่อยู่'),
  subdistrict: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  province: z.string().min(1, 'ต้องระบุจังหวัด'),
  postcode: z.string().regex(/^\d{5}$/, 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก'),
  carrier: z.enum(['flash', 'jnt']).default('flash'),
  customer_note: z.string().optional().nullable(),
})

/**
 * สร้างคำสั่งซื้อจากตะกร้า
 *
 * งานจริงอยู่ในฟังก์ชัน Postgres `fn_create_orders_from_cart` เพราะ:
 *  - ราคาและค่าส่งต้องคิดจากฐานข้อมูล ไม่ใช่จากค่าที่ browser ส่งมา
 *    (ลูกค้าถือ session จริง ยิง PostgREST ตรงได้ การตรวจในโค้ดหน้าเว็บจึงไม่พอ)
 *  - การเช็คสต็อก + จองของ ต้องอยู่ใน transaction เดียวกับการสร้างออเดอร์
 *  - ถ้าตะกร้ามีทั้งของพร้อมส่งและของสั่งจอง จะถูกแยกเป็น 2 ออเดอร์ให้อัตโนมัติ
 */
export async function createOrders(
  _prev: ShopState,
  formData: FormData
): Promise<ShopState> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, message: 'กรุณาเข้าสู่ระบบก่อน' }

  const raw = Object.fromEntries(formData.entries())
  const parsed = addressSchema.safeParse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === '' ? undefined : v]))
  )
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }
  }
  const addr = parsed.data

  const supabase = await createClient()

  const { data: orderIds, error } = await supabase.rpc('fn_create_orders_from_cart', {
    p_shipping_address: {
      recipient_name: addr.recipient_name,
      phone: addr.phone,
      line1: addr.line1,
      subdistrict: addr.subdistrict ?? null,
      district: addr.district ?? null,
      province: addr.province,
      postcode: addr.postcode,
      carrier: addr.carrier,
    },
    p_customer_note: addr.customer_note ?? null,
  })

  if (error) return { ok: false, message: error.message }

  const ids = (orderIds ?? []) as string[]
  if (ids.length === 0) return { ok: false, message: 'สร้างคำสั่งซื้อไม่สำเร็จ' }

  // เก็บที่อยู่ไว้ใช้ครั้งหน้า (ล้มเหลวก็ไม่เป็นไร ไม่ควรทำให้การสั่งซื้อพัง)
  await supabase.from('addresses').insert({
    user_id: customer.id,
    recipient_name: addr.recipient_name,
    phone: addr.phone,
    line1: addr.line1,
    subdistrict: addr.subdistrict ?? null,
    district: addr.district ?? null,
    province: addr.province,
    postcode: addr.postcode,
    is_default: true,
  })

  revalidatePath('/shop', 'layout')
  redirect(`/shop/orders/${ids[0]}`)
}

// ---------------- แนบสลิป ----------------

export async function uploadSlip(
  _prev: ShopState,
  formData: FormData
): Promise<ShopState> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, message: 'กรุณาเข้าสู่ระบบก่อน' }

  const orderId = String(formData.get('order_id') ?? '')
  const purpose = String(formData.get('purpose') ?? 'full')
  const file = formData.get('slip') as File | null
  if (!orderId || !file || file.size === 0) {
    return { ok: false, message: 'กรุณาเลือกไฟล์สลิป' }
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, message: 'ไฟล์ใหญ่เกิน 5 MB' }
  }

  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, total, status, user_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order || order.user_id !== customer.id) {
    return { ok: false, message: 'ไม่พบคำสั่งซื้อนี้' }
  }
  const expected = purpose === 'balance' ? 'awaiting_balance' : 'pending_payment'
  if (order.status !== expected) {
    return { ok: false, message: 'สถานะคำสั่งซื้อไม่ตรงกับการชำระเงินนี้' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${orderId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('slips')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) return { ok: false, message: `อัปโหลดไม่สำเร็จ: ${uploadError.message}` }

  // บันทึกลงตาราง payments ผ่านฟังก์ชัน เพื่อให้ยอดเงินมาจากออเดอร์เสมอ
  const { data: paymentId, error: payError } = await supabase.rpc('fn_attach_slip', {
    p_order_id: orderId,
    p_slip_path: path,
    p_purpose: purpose,
  })

  if (payError) return { ok: false, message: payError.message }

  const result = await autoVerifySlip({
    paymentId: paymentId as string,
    orderId,
    expectedAmount: Number(order.total),
    file,
  })

  revalidatePath(`/shop/orders/${orderId}`)
  return result
}

/**
 * ตรวจสลิปอัตโนมัติ แล้วยืนยันเงินถ้าผ่านทุกเงื่อนไข
 *
 * หลักการสำคัญ: **ห้ามล้มเหลวแล้วทำให้ลูกค้าเสียหาย**
 * ถ้าตรวจไม่ผ่านด้วยเหตุใดก็ตาม — API ล่ม โควตาหมด รูปเบลอ ยอดไม่ตรง —
 * สลิปยังถูกบันทึกไว้เรียบร้อยและตกไปให้แอดมินตรวจมือเหมือนเดิม
 * ไม่มีเส้นทางไหนที่ทำให้สลิปหายหรือออเดอร์ค้างโดยไม่มีใครรู้
 */
async function autoVerifySlip(p: {
  paymentId: string
  orderId: string
  expectedAmount: number
  file: File
}): Promise<ShopState> {
  const manual = { ok: true, message: 'ส่งสลิปแล้ว รอแอดมินตรวจสอบ' }

  if (!isSlip2GoConfigured()) return manual

  // ใช้ admin client เพราะขั้นตอนยืนยันเงินต้องแตะสต็อกและใบเสร็จ
  // ซึ่งลูกค้าไม่มีสิทธิ์ — แต่ข้อมูลที่ใช้ตัดสินใจมาจากผลตรวจของธนาคาร
  // ไม่ได้มาจากสิ่งที่ลูกค้าส่งมา จึงไม่เปิดช่องให้ปลอมสถานะ
  const admin = createAdminClient()

  try {
    const base64 = Buffer.from(await p.file.arrayBuffer()).toString('base64')
    const check = await verifySlipBase64({
      base64,
      expectedAmount: p.expectedAmount,
    })

    if (!check.verified) {
      await admin.rpc('fn_record_slip_check', {
        p_payment_id: p.paymentId,
        p_payload: check.raw ?? { code: check.code, message: check.message },
      })
      return {
        ok: true,
        message: `ส่งสลิปแล้ว — ระบบตรวจอัตโนมัติยังไม่ผ่าน (${check.message}) แอดมินจะตรวจสอบให้อีกครั้ง`,
      }
    }

    const { data: outcome, error } = await admin.rpc('fn_auto_confirm_slip', {
      p_payment_id: p.paymentId,
      p_trans_ref: check.transRef,
      p_payload: check.raw ?? {},
    })

    if (error) {
      console.error('[slip] ยืนยันอัตโนมัติล้มเหลว:', error.message)
      return manual
    }

    if (outcome === 'duplicate') {
      return {
        ok: false,
        message: 'สลิปนี้เคยถูกใช้กับคำสั่งซื้ออื่นแล้ว กรุณาแนบสลิปของรายการนี้',
      }
    }
    if (outcome !== 'confirmed') return manual

    // ยืนยันแล้ว = trigger ใส่ข้อความลงคิวไว้ ส่งออกทันทีไม่ต้องรอ cron
    await drainNotificationsSafely()

    return { ok: true, message: 'ยืนยันการชำระเงินอัตโนมัติแล้ว กำลังจัดเตรียมพัสดุ' }
  } catch (e) {
    console.error('[slip] ตรวจอัตโนมัติมีข้อผิดพลาด:', e)
    return manual
  }
}
