/**
 * ตาข่ายรองรับการส่งแจ้งเตือน — รันทุกชั่วโมง (ตั้งเวลาไว้ใน netlify.toml)
 *
 * ลูกค้าไม่ได้รอฟังก์ชันนี้ เพราะแจ้งเตือนถูกส่งทันทีตอนแอดมินเปลี่ยนสถานะ
 * ตัวนี้มีไว้เก็บข้อความที่ส่งพลาดตอนนั้นมาส่งซ้ำ
 */
export default async function handler() {
  const base = process.env.URL || process.env.NEXT_PUBLIC_APP_URL
  if (!base) {
    console.error('[cron] ไม่รู้ URL ของเว็บ')
    return new Response('missing URL', { status: 500 })
  }

  const res = await fetch(`${base}/api/cron/send-notifications`, {
    headers: process.env.CRON_SECRET
      ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
      : {},
  })

  const body = await res.text()
  console.log('[cron] send-notifications:', res.status, body)
  return new Response(body, { status: res.status })
}
