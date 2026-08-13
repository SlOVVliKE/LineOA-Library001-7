/**
 * ล้างการจองสต็อกที่หมดอายุ — รันวันละครั้ง
 *
 * ไม่ต้องรันถี่ เพราะทุกจุดที่คำนวณของคงเหลือกรอง expires_at > now() อยู่แล้ว
 * แถวที่ค้างจึงไม่เคยทำให้ตัวเลขผิด ฟังก์ชันนี้แค่มาเก็บกวาดให้ตารางไม่บวม
 */
export default async function handler() {
  const base = process.env.URL || process.env.NEXT_PUBLIC_APP_URL
  if (!base) return new Response('missing URL', { status: 500 })

  const res = await fetch(`${base}/api/cron/expire-reservations`, {
    headers: process.env.CRON_SECRET
      ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
      : {},
  })

  const body = await res.text()
  console.log('[cron] expire-reservations:', res.status, body)
  return new Response(body, { status: res.status })
}
