import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * ปลายทางของลิงก์ที่ส่งไปในอีเมล (กู้รหัสผ่าน / ยืนยันอีเมล)
 *
 * ลิงก์ในอีเมลพาผู้ใช้มาที่นี่พร้อมรหัสใช้ครั้งเดียว หน้าที่ของ route นี้คือ
 * แลกรหัสนั้นเป็น session จริงแล้วส่งต่อไปหน้าที่ควรไป
 *
 * รองรับสองรูปแบบโดยตั้งใจ
 *   ?code=...                    -> เทมเพลตอีเมลแบบใหม่ (PKCE)
 *   ?token_hash=...&type=...     -> เทมเพลตแบบเก่าที่ยังใช้ {{ .TokenHash }}
 * โปรเจกต์ที่สร้างไว้นานแล้วมักยังเป็นแบบหลัง ถ้ารองรับแค่แบบเดียว
 * ลิงก์จะเด้งกลับหน้า login แบบไม่บอกสาเหตุ แล้วไล่หาสาเหตุยากมาก
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null

  /**
   * ตรวจ next ก่อนใช้เสมอ — ป้องกัน open redirect
   *
   * ถ้าปล่อยให้ใส่ค่าอะไรก็ได้ คนร้ายส่งลิงก์
   * /auth/callback?next=https://เว็บปลอม ให้เหยื่อ พอกดแล้วจะเด้งไปเว็บปลอม
   * ทั้งที่ต้นทางเป็นโดเมนของเราจริง ซึ่งดูน่าเชื่อถือกว่าลิงก์ปลอมทั่วไปมาก
   *
   * เงื่อนไข: ต้องขึ้นต้นด้วย / เดี่ยวๆ เท่านั้น
   * ("//evil.com" เป็น URL ข้ามโดเมนได้ จึงต้องกันด้วย)
   */
  const rawNext = url.searchParams.get('next')
  const next = rawNext && /^\/(?!\/)/.test(rawNext) ? rawNext : '/admin'

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }

  // ลิงก์หมดอายุ ถูกใช้ไปแล้ว หรือถูกแก้ระหว่างทาง
  return NextResponse.redirect(new URL('/login?error=link', url.origin))
}
