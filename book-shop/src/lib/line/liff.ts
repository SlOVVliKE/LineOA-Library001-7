'use client'

/**
 * เริ่มต้น LIFF และดึง ID token
 *
 * ถ้ายังไม่ได้ตั้ง NEXT_PUBLIC_LIFF_ID (ยังไม่มี LINE channel) จะคืน null
 * แล้วหน้าร้านจะ fallback ไปใช้โหมดทดสอบแทน — โค้ดเส้นทางเดียวกันทั้งคู่
 */
export async function getLiffIdToken(): Promise<string | null> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  if (!liffId) return null

  const liff = (await import('@line/liff')).default
  await liff.init({ liffId })
  if (!liff.isLoggedIn()) {
    liff.login()
    return null
  }
  return liff.getIDToken()
}

export function isInLineApp(): boolean {
  return typeof navigator !== 'undefined' && /Line/i.test(navigator.userAgent)
}
