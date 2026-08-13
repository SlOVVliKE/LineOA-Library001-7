import 'server-only'

const API = 'https://api.line.me/v2/bot'

export interface LineMessage {
  type: string
  [key: string]: unknown
}

function token(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!t) throw new Error('ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN')
  return t
}

export function isLineConfigured(): boolean {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET)
}

async function call(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`LINE API ${res.status}: ${text.slice(0, 300)}`)
  }
}

/**
 * ตอบกลับข้อความที่ลูกค้าทักมา
 *
 * ใช้อันนี้ให้มากที่สุด เพราะ **reply ไม่นับโควตา** ส่วน push นับ
 * replyToken ใช้ได้ครั้งเดียวและหมดอายุใน ~1 นาที
 */
export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  await call('/message/reply', { replyToken, messages: messages.slice(0, 5) })
}

/** ส่งหาลูกค้าโดยไม่ได้ถูกทัก — นับโควตา */
export async function pushMessage(to: string, messages: LineMessage[]) {
  await call('/message/push', { to, messages: messages.slice(0, 5) })
}

/** ส่งหาหลายคนพร้อมกัน ประหยัดกว่า push ทีละคน */
export async function multicast(to: string[], messages: LineMessage[]) {
  if (to.length === 0) return
  await call('/message/multicast', { to: to.slice(0, 500), messages: messages.slice(0, 5) })
}

/** โควตาข้อความที่เหลือในเดือนนี้ */
export async function getQuotaConsumption(): Promise<number | null> {
  const res = await fetch(`${API}/message/quota/consumption`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = (await res.json()) as { totalUsage?: number }
  return data.totalUsage ?? null
}

export async function getProfile(lineUserId: string) {
  const res = await fetch(`${API}/profile/${lineUserId}`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as { displayName: string; pictureUrl?: string }
}
