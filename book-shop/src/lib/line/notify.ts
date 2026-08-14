import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushMessage, isLineConfigured } from './client'
import {
  orderPaidMessage, preorderConfirmedMessage, preorderArrivedMessage,
  awaitingBalanceMessage, orderShippedMessage, orderDeliveredMessage,
  orderCancelledMessage, bookBackInStockMessage,
} from './flex'
import type { LineMessage } from './client'

const MAX_ATTEMPTS = 3

export interface DrainResult {
  sent: number
  failed: number
  skipped: number
}

/**
 * ระบายคิวแจ้งเตือน
 *
 * เรียกได้ 2 ทาง:
 *   1. จาก server action ทันทีหลังเปลี่ยนสถานะ — ลูกค้าได้รับแจ้งภายในไม่กี่วินาที
 *   2. จาก cron เป็นตาข่ายรองรับ — เก็บตกอันที่ส่งพลาดหรือหลุดไป
 *
 * ทำไมต้องมีทั้งสองทาง: ถ้าพึ่ง cron อย่างเดียว Vercel Hobby ให้รันได้วันละครั้ง
 * ลูกค้าจะรอแจ้งเตือนนานเกินรับได้ แต่ถ้าพึ่งการเรียกตอน action อย่างเดียว
 * ครั้งที่ LINE ล่มพอดีข้อความจะค้างในคิวตลอดกาลโดยไม่มีใครมาเก็บ
 */
export async function drainNotifications(limit = 25): Promise<DrainResult> {
  const result: DrainResult = { sent: 0, failed: 0, skipped: 0 }
  if (!isLineConfigured()) return result

  const admin = createAdminClient()

  const { data: queue } = await admin
    .from('notifications')
    .select('id, line_user_id, type, payload, attempts')
    .eq('status', 'queued')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at')
    .limit(limit)

  for (const n of queue ?? []) {
    const lineUserId = n.line_user_id as string | null
    const payload = (n.payload ?? {}) as Record<string, unknown>
    const message = lineUserId ? buildMessage(n.type as string, payload) : null

    if (!message) {
      await admin.from('notifications')
        .update({
          status: 'skipped',
          last_error: lineUserId ? `ไม่รู้จักชนิด: ${n.type}` : 'ลูกค้ายังไม่ได้ผูก LINE',
        })
        .eq('id', n.id)
      result.skipped++
      continue
    }

    try {
      await pushMessage(lineUserId!, [message])
      await admin.from('notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          attempts: Number(n.attempts) + 1,
        })
        .eq('id', n.id)
      result.sent++
    } catch (e) {
      const attempts = Number(n.attempts) + 1
      await admin.from('notifications')
        .update({
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
          last_error: e instanceof Error ? e.message.slice(0, 500) : 'ส่งไม่สำเร็จ',
        })
        .eq('id', n.id)
      result.failed++
    }
  }

  return result
}

/**
 * เรียกจาก server action — ห้ามให้ LINE ล่มแล้วทำให้การยืนยันออเดอร์พังตาม
 * ข้อความยังอยู่ในคิว cron จะมาเก็บให้เอง
 */
export async function drainNotificationsSafely(limit = 10): Promise<void> {
  try {
    await drainNotifications(limit)
  } catch (e) {
    console.error('[notify] ส่งแจ้งเตือนไม่สำเร็จ (ข้อความยังอยู่ในคิว):', e)
  }
}

function buildMessage(type: string, p: Record<string, unknown>): LineMessage | null {
  const orderId = String(p.order_id ?? '')
  const orderNo = String(p.order_no ?? '')
  const total = Number(p.total ?? 0)

  switch (type) {
    case 'order_paid':         return orderPaidMessage({ orderId, orderNo, total })
    case 'preorder_confirmed': return preorderConfirmedMessage({ orderId, orderNo, total })
    case 'preorder_arrived':   return preorderArrivedMessage({ orderId, orderNo })
    case 'awaiting_balance':   return awaitingBalanceMessage({
                                 orderId, orderNo, balanceDue: Number(p.balance_due ?? 0) })
    case 'order_shipped':      return orderShippedMessage({
                                 orderId, orderNo, trackingNo: (p.tracking_no as string) ?? null })
    case 'order_delivered':    return orderDeliveredMessage({ orderId, orderNo })
    case 'order_cancelled':    return orderCancelledMessage({ orderId, orderNo })
    case 'book_back_in_stock': return bookBackInStockMessage({
                                 bookId: String(p.book_id ?? ''),
                                 title: String(p.title ?? 'หนังสือ'),
                                 price: Number(p.price ?? 0) })
    default:                   return null
  }
}
