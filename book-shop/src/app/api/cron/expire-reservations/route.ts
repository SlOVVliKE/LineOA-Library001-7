import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * ปลดล็อกสต็อกที่ถูกจองไว้แต่ลูกค้าไม่จ่ายภายใน 30 นาที
 *
 * ไม่ต้องยิงถี่ เพราะทุกจุดที่คำนวณของคงเหลือกรอง expires_at > now() อยู่แล้ว
 * แถวที่หมดอายุจึงไม่เคยทำให้ยอดคงเหลือผิด — งานนี้คือการเก็บกวาดตาราง
 * ตั้งไว้วันละครั้งใน wrangler.jsonc → triggers.crons ("20 3 * * *" = 10:20 น. ไทย)
 *
 * ป้องกันด้วย CRON_SECRET เพราะ endpoint นี้เปิดสาธารณะ
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 })
    }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('fn_expire_reservations')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, expired: data ?? 0 })
}
