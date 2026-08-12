import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * ข้าม RLS ทั้งหมด — ใช้เฉพาะงานระบบเท่านั้น เช่น
 * webhook จาก LINE / ขนส่ง / marketplace และ cron job
 *
 * ห้ามใช้ในเส้นทางที่มาจากผู้ใช้โดยตรง
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('ไม่พบ SUPABASE_SERVICE_ROLE_KEY')

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
