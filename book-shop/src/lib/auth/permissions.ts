import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { PermissionCode } from '@/lib/types/db'

export interface CurrentUser {
  id: string
  authUserId: string
  displayName: string | null
  email: string | null
  roles: string[]
  permissions: PermissionCode[]
}

/**
 * ดึงผู้ใช้ปัจจุบันพร้อมสิทธิ์ทั้งหมด — คืน null ถ้ายังไม่ล็อกอิน
 *
 * ห่อด้วย cache() ของ React เพราะ layout กับ page ต่างก็เรียกฟังก์ชันนี้
 * ถ้าไม่ห่อ การโหลดหน้าเดียวจะยิงไป Supabase 4 รอบ (ถามว่าใคร 2 + query สิทธิ์ 2)
 * cache() ทำให้เรียกกี่ครั้งก็ตามในการ render ครั้งเดียว ได้ผลลัพธ์เดิมโดยไม่ยิงซ้ำ
 * และล้างเองเมื่อจบ request จึงไม่มีปัญหาข้อมูลค้างข้ามผู้ใช้
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient()

  // เรียก RPC ตัวเดียวจบ แทนที่จะยิง auth.getUser() แล้วตามด้วย query สิทธิ์
  // PostgREST ตรวจลายเซ็น JWT ให้ก่อนตั้ง auth.uid() ความปลอดภัยจึงเท่าเดิม
  const { data, error } = await supabase.rpc('fn_me')

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      // เจอบ่อย: "permission denied for table X" = ลืม GRANT (ดู migration 0010)
      console.error('[getCurrentUser] อ่านข้อมูลผู้ใช้ไม่สำเร็จ:', error.message)
    }
    return null
  }
  if (!data) return null

  const me = data as {
    id: string
    auth_user_id: string
    display_name: string | null
    email: string | null
    roles: string[]
    permissions: string[]
  }

  return {
    id: me.id,
    authUserId: me.auth_user_id,
    displayName: me.display_name,
    email: me.email,
    roles: me.roles ?? [],
    permissions: (me.permissions ?? []) as PermissionCode[],
  }
})

/**
 * บังคับสิทธิ์ในหน้า Admin และ Server Action
 * หมายเหตุ: นี่เป็นด่านที่สอง — ด่านจริงคือ RLS ในฐานข้อมูล
 */
export async function requirePermission(code: PermissionCode): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.permissions.includes(code)) redirect('/admin/forbidden')
  return user
}

export function can(user: CurrentUser | null, code: PermissionCode): boolean {
  return !!user?.permissions.includes(code)
}
