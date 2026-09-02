import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export interface AdminWorkQueue {
  slipsPending: number
  ordersAwaitingPayment: number
  ordersToShip: number
  ordersAwaitingBalance: number
  preordersWaiting: number
  notificationsFailed: number
  notificationsQueued: number
}

const EMPTY: AdminWorkQueue = {
  slipsPending: 0,
  ordersAwaitingPayment: 0,
  ordersToShip: 0,
  ordersAwaitingBalance: 0,
  preordersWaiting: 0,
  notificationsFailed: 0,
  notificationsQueued: 0,
}

/**
 * ตัวเลขงานค้างทั้งหมดของหลังบ้าน (เมนูข้าง + หน้า "งานวันนี้" ต้องใช้ทั้งคู่)
 *
 * ห่อด้วย cache() เหมือน getCurrentUser — layout (เมนูข้าง) กับหน้าแรก (งานวันนี้)
 * ต่างก็เรียกฟังก์ชันนี้ในการ render เดียวกัน ถ้าไม่ห่อจะยิง view นี้ซ้ำสองรอบ
 *
 * ดึงจาก v_admin_work_queue ซึ่งเป็น security_invoker — บัญชีที่ไม่มีสิทธิ์อ่าน
 * ตารางไหนจะได้ 0 จาก RLS ของตารางนั้นเอง ไม่ต้องเช็คสิทธิ์ซ้ำที่นี่
 */
export const getAdminWorkQueue = cache(async function getAdminWorkQueue(): Promise<AdminWorkQueue> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('v_admin_work_queue').select('*').single()

  if (error || !data) {
    if (process.env.NODE_ENV === 'development' && error) {
      console.error('[getAdminWorkQueue] อ่านตัวเลขงานค้างไม่สำเร็จ:', error.message)
    }
    return EMPTY
  }

  return {
    slipsPending: Number(data.slips_pending ?? 0),
    ordersAwaitingPayment: Number(data.orders_awaiting_payment ?? 0),
    ordersToShip: Number(data.orders_to_ship ?? 0),
    ordersAwaitingBalance: Number(data.orders_awaiting_balance ?? 0),
    preordersWaiting: Number(data.preorders_waiting ?? 0),
    notificationsFailed: Number(data.notifications_failed ?? 0),
    notificationsQueued: Number(data.notifications_queued ?? 0),
  }
})
