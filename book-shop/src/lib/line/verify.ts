import 'server-only'

export interface LineProfile {
  lineUserId: string
  displayName: string | null
  pictureUrl: string | null
}

/**
 * ตรวจสอบ ID token ของ LINE กับเซิร์ฟเวอร์ LINE
 *
 * สำคัญ: ห้ามเชื่อ line_user_id ที่ client ส่งมาตรงๆ เด็ดขาด
 * ต้องให้ LINE ยืนยันก่อนเสมอ ไม่งั้นใครก็ปลอมเป็นลูกค้าคนอื่นได้
 *
 * ระวัง: ต้องใช้ ID ของ **LINE Login channel** ไม่ใช่ Messaging API channel
 * เพราะ ID token ออกโดย LIFF ซึ่งอยู่ใต้ Login channel — ค่า aud ในโทเคนคือ ID ตัวนั้น
 * ใส่ผิดจะได้ error "ตรวจสอบ LINE ID token ไม่ผ่าน" โดยไม่บอกว่าเพราะอะไร
 * จึงตั้งชื่อตัวแปรให้ต่างกันชัดเจน ไม่ใช้ LINE_CHANNEL_ID ที่กำกวม
 */
export async function verifyLineIdToken(idToken: string): Promise<LineProfile> {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  if (!channelId) throw new Error('ยังไม่ได้ตั้ง LINE_LOGIN_CHANNEL_ID')

  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    cache: 'no-store',
  })

  if (!res.ok) throw new Error('ตรวจสอบ LINE ID token ไม่ผ่าน')

  const data = (await res.json()) as {
    sub: string
    name?: string
    picture?: string
  }

  return {
    lineUserId: data.sub,
    displayName: data.name ?? null,
    pictureUrl: data.picture ?? null,
  }
}
