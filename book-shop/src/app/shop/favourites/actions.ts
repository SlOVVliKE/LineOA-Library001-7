'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'

export type FavouriteState = { ok: boolean; starred?: boolean; message?: string }

/**
 * สลับสถานะติดดาว
 *
 * ไม่รับค่าสถานะจาก client เพราะเชื่อไม่ได้ — อ่านจากฐานข้อมูลแล้วสลับเอง
 * ถ้ากดรัวหลายครั้ง อย่างมากคือได้ผลลัพธ์ตามครั้งสุดท้าย ไม่มีแถวซ้ำ
 * เพราะ primary key เป็น (user_id, book_id)
 */
export async function toggleFavourite(bookId: string): Promise<FavouriteState> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, message: 'กรุณาเข้าสู่ระบบก่อน' }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('book_favourites')
    .select('book_id')
    .eq('user_id', customer.id)
    .eq('book_id', bookId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('book_favourites')
      .delete()
      .eq('user_id', customer.id)
      .eq('book_id', bookId)
    if (error) return { ok: false, message: error.message }

    revalidatePath('/shop/favourites')
    revalidatePath(`/shop/books/${bookId}`)
    return { ok: true, starred: false, message: 'เอาออกจากรายการโปรดแล้ว' }
  }

  const { error } = await supabase
    .from('book_favourites')
    .insert({ user_id: customer.id, book_id: bookId })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/shop/favourites')
  revalidatePath(`/shop/books/${bookId}`)
  return { ok: true, starred: true, message: 'เพิ่มในรายการโปรดแล้ว' }
}
