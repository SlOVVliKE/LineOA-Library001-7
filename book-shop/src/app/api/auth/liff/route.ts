import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { verifyLineIdToken, type LineProfile } from '@/lib/line/verify'

/**
 * แลก LINE ID token เป็น session ของ Supabase
 *
 * ทำไมต้องผ่าน Supabase auth แทนที่จะใช้ cookie ของเราเอง:
 * เพราะ RLS ทุก policy อ้างอิง auth.uid() ถ้าลูกค้าไม่มี session จริง
 * เราจะต้องใช้ service role ทำงานแทนลูกค้า ซึ่งข้าม RLS ทั้งหมด
 * และกลายเป็นว่าความปลอดภัยขึ้นกับความถูกต้องของโค้ดล้วนๆ
 *
 * โหมดทดสอบ (ยังไม่มี LINE channel):
 *   ส่ง devLineUserId มาแทน idToken ได้ เฉพาะตอน NODE_ENV=development
 *   เส้นทางโค้ดหลังจากนี้เหมือนกันทุกประการกับตอนใช้ LINE จริง
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    idToken?: string
    devLineUserId?: string
    displayName?: string
  }

  let profile: LineProfile

  if (body.idToken) {
    try {
      profile = await verifyLineIdToken(body.idToken)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'ยืนยันตัวตนไม่สำเร็จ' },
        { status: 401 }
      )
    }
  } else if (body.devLineUserId && process.env.NODE_ENV === 'development') {
    profile = {
      lineUserId: body.devLineUserId,
      displayName: body.displayName ?? 'ลูกค้าทดสอบ',
      pictureUrl: null,
    }
  } else {
    return NextResponse.json({ error: 'ไม่พบ ID token' }, { status: 400 })
  }

  const secret = process.env.APP_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้ง APP_SECRET' }, { status: 500 })
  }

  // รหัสผ่านสร้างจาก line_user_id + APP_SECRET — ไม่เคยส่งออกไปฝั่ง client
  const password = createHmac('sha256', secret).update(profile.lineUserId).digest('hex')
  const email = `${profile.lineUserId.toLowerCase()}@line.local`

  const admin = createAdminClient()

  // สร้างบัญชีถ้ายังไม่มี (ซ้ำแล้วข้าม)
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { line_user_id: profile.lineUserId, display_name: profile.displayName },
  })
  if (createError && !/already/i.test(createError.message)) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // ล็อกอินผ่าน server client เพื่อให้ cookie ถูกตั้งให้อัตโนมัติ
  const supabase = await createClient()
  const { data: signIn, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password })

  if (signInError || !signIn.user) {
    return NextResponse.json(
      { error: signInError?.message ?? 'เข้าสู่ระบบไม่สำเร็จ' },
      { status: 401 }
    )
  }

  // ---------- ผูกกับแถวใน public.users ----------
  //
  // ตาราง users มี unique 3 คอลัมน์: auth_user_id, line_user_id, email
  // upsert สั่งชนได้ทีละคอลัมน์เดียว ถ้าเลือก onConflict เป็น auth_user_id
  // แล้วบังเอิญมีแถวเก่าถือ line_user_id นี้อยู่โดยผูกกับ auth user คนละตัว
  // Postgres จะพยายาม INSERT แล้วชน users_line_user_id_key ทันที
  //
  // เกิดขึ้นจริงเมื่อ auth user ถูกลบทิ้งแต่แถวใน public.users ยังอยู่
  // (ไม่มี FK ผูกไว้) แล้วลูกค้าคนเดิมล็อกอินใหม่ ระบบสร้าง auth user ใหม่ให้
  //
  // จึงต้องยึด line_user_id เป็นหลัก เพราะนั่นคือตัวตนที่แท้จริงของลูกค้า
  // ส่วน auth_user_id เป็นแค่กลไกภายในที่สร้างใหม่ได้เสมอ
  const { data: existingByLine } = await admin
    .from('users')
    .select('id, auth_user_id')
    .eq('line_user_id', profile.lineUserId)
    .maybeSingle()

  const profileFields = {
    auth_user_id: signIn.user.id,
    line_user_id: profile.lineUserId,
    display_name: profile.displayName,
    picture_url: profile.pictureUrl,
    email,
  }

  const { error: linkError } = existingByLine
    ? await admin.from('users').update(profileFields).eq('id', existingByLine.id)
    : await admin.from('users').upsert(profileFields, { onConflict: 'auth_user_id' })

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, displayName: profile.displayName })
}
