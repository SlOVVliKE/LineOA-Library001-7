'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'

export type PreorderState = { ok: boolean; message?: string }

/**
 * จ่ายของให้คิวสั่งจองด้วยมือ
 *
 * ปกติระบบจ่ายให้อัตโนมัติตอนกด "รับสินค้าเข้า" อยู่แล้ว
 * ปุ่มนี้ไว้ใช้กรณีของเข้ามาก่อนหน้านี้แล้วแต่ยังไม่ได้จ่าย
 * เช่น เพิ่งมาสร้างคิวทีหลัง หรือคิวถูกปลดล็อกจากออเดอร์ที่ยกเลิก
 */
export async function fulfillQueue(bookId: string): Promise<PreorderState> {
  const user = await requirePermission('lot.write')
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('fn_fulfill_preorders', {
    p_book_id: bookId,
    p_created_by: user.id,
  })

  if (error) return { ok: false, message: error.message }

  const filled = Number(data ?? 0)
  revalidatePath('/admin/preorders')
  revalidatePath('/admin/orders')
  revalidatePath('/admin/stock')

  return filled > 0
    ? { ok: true, message: `จ่ายของให้คิวไปแล้ว ${filled} เล่ม` }
    : { ok: true, message: 'ยังไม่มีของพอจ่ายให้คิว หรือจ่ายครบแล้ว' }
}

export async function cancelPreorder(orderId: string): Promise<PreorderState> {
  await requirePermission('order.read')
  const supabase = await createClient()

  const { error } = await supabase.rpc('fn_cancel_preorder', { p_order_id: orderId })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/admin/preorders')
  revalidatePath('/admin/orders')
  return { ok: true, message: 'ยกเลิกการสั่งจองแล้ว' }
}
