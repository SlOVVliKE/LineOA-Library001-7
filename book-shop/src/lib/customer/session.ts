import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export interface Customer {
  id: string
  displayName: string | null
  lineUserId: string | null
}

/**
 * ลูกค้าที่ล็อกอินอยู่ — คืน null ถ้ายังไม่ได้ล็อกอิน
 * ห่อ cache() ด้วยเหตุผลเดียวกับ getCurrentUser (layout กับ page เรียกซ้ำกัน)
 */
export const getCustomer = cache(async function getCustomer(): Promise<Customer | null> {
  const supabase = await createClient()

  // ใช้ RPC ตัวเดียวเหมือนฝั่งแอดมิน แทนที่จะยิง auth.getUser() แล้วตามด้วย query
  // ลดจาก 2 รอบ HTTP เหลือ 1 รอบ (ดู migration 0015_fn_me.sql)
  const { data } = await supabase.rpc('fn_me')
  if (!data) return null

  const me = data as {
    id: string
    display_name: string | null
    line_user_id: string | null
  }

  return {
    id: me.id,
    displayName: me.display_name,
    lineUserId: me.line_user_id,
  }
})

/** ตะกร้าของลูกค้า สร้างให้ถ้ายังไม่มี */
export async function getOrCreateCartId(customerId: string): Promise<string> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('cart')
    .select('id')
    .eq('user_id', customerId)
    .maybeSingle()

  if (existing) return existing.id as string

  const { data, error } = await supabase
    .from('cart')
    .insert({ user_id: customerId })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}
