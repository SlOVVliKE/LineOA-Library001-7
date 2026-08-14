'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { drainNotificationsSafely } from '@/lib/line/notify'

export type NotifyState = { ok: boolean; message?: string }

/**
 * แจ้งลูกค้าที่ติดดาวเล่มนี้ว่าของเข้าแล้ว
 *
 * แอดมินกดเอง ไม่ใช่ trigger อัตโนมัติ เพราะ push ฟรีมีแค่ 300 ข้อความ/เดือน
 * ถ้ายิงอัตโนมัติทุกครั้งที่รับของเข้า วันเดียวโควตาอาจหมด
 * แล้วแจ้งเตือนออเดอร์ของลูกค้าที่จ่ายเงินจริงจะส่งไม่ออก
 */
export async function notifyFavourites(bookId: string): Promise<NotifyState> {
  await requirePermission('book.write')
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('fn_notify_favourites', { p_book_id: bookId })
  if (error) return { ok: false, message: error.message }

  const queued = Number(data ?? 0)
  if (queued === 0) {
    return { ok: true, message: 'ทุกคนที่ติดดาวเล่มนี้ได้รับแจ้งไปแล้ว' }
  }

  await drainNotificationsSafely(Math.min(queued, 100))

  revalidatePath('/admin/favourites')
  revalidatePath('/admin/notifications')
  return { ok: true, message: `ส่งแจ้งเตือนแล้ว ${queued} คน` }
}

/**
 * ล้างสถานะ "แจ้งแล้ว" เพื่อให้แจ้งได้อีกรอบเมื่อของหมดแล้วเข้าใหม่
 *
 * ไม่ทำอัตโนมัติตอนของหมด เพราะของอาจหมดชั่วคราวระหว่างวัน
 * แล้วลูกค้าจะโดนแจ้งซ้ำเล่มเดิมหลายรอบจนรำคาญ
 */
export async function resetFavouriteNotices(bookId: string): Promise<NotifyState> {
  await requirePermission('book.write')
  const supabase = await createClient()

  const { error } = await supabase.rpc('fn_reset_favourite_notices', { p_book_id: bookId })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/admin/favourites')
  return { ok: true, message: 'พร้อมแจ้งเตือนรอบใหม่แล้ว' }
}
