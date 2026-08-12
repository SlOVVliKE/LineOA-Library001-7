'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** ออกจากระบบ — ล้าง session cookie แล้วส่งกลับหน้าล็อกอิน */
export async function signOut(redirectTo = '/login') {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(redirectTo)
}
