import { drainNotifications } from '@/lib/line/notify'
import { isLineConfigured } from '@/lib/line/client'

export const dynamic = 'force-dynamic'

/**
 * ตาข่ายรองรับ — เก็บตกแจ้งเตือนที่ส่งพลาดตอน server action
 *
 * ลูกค้าไม่ได้รอ cron นี้ เพราะแจ้งเตือนถูกส่งทันทีตอนสถานะเปลี่ยนอยู่แล้ว
 * ตัวนี้มีไว้เก็บข้อความที่ส่งพลาดตอนนั้น (เช่น LINE ล่มชั่วขณะ) มาส่งซ้ำ
 * ตั้งเวลาไว้ที่ wrangler.jsonc → triggers.crons ("0 * * * *")
 * และ custom-worker.ts เป็นตัวเรียก route นี้ตอนถึงเวลา
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 })
    }
  }

  if (!isLineConfigured()) {
    return Response.json({ ok: true, skipped: 'ยังไม่ได้ตั้งค่า LINE' })
  }

  const result = await drainNotifications(100)
  return Response.json({ ok: true, ...result })
}
