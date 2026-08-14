'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'

export type CategoryState = { ok: boolean; message?: string }

/**
 * สร้าง slug จากชื่อหมวด
 *
 * slug ใช้เป็นคีย์ถาวรของหมวด (ไม่เปลี่ยนตามชื่อ) และต้องไม่ซ้ำ
 * ชื่อหมวดภาษาไทยแปลงเป็น ASCII ไม่ได้ จึงเก็บอักษรไทยไว้ตรงๆ
 * แล้วตัดเฉพาะอักขระที่ใช้ใน URL ไม่ได้ออก — Postgres กับ URL รองรับ UTF-8 อยู่แล้ว
 * ถ้าตัดจนเหลือว่าง (เช่นชื่อเป็นอิโมจิล้วน) ค่อย fallback เป็นเลขเวลา
 */
function toSlug(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[\s/\\]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s || `cat-${Date.now()}`
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'ต้องใส่ชื่อหมวดหมู่').max(60, 'ชื่อยาวเกิน 60 ตัวอักษร'),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
})

export async function createCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  await requirePermission('book.write')

  const parsed = createSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }
  }
  const { name, sort_order } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from('categories')
    .insert({ name, slug: toSlug(name), sort_order })

  if (error) {
    // 23505 = unique violation — กรณีเดียวที่เกิดคือ slug ซ้ำ แปลว่ามีหมวดชื่อนี้อยู่แล้ว
    return {
      ok: false,
      message: error.code === '23505' ? `มีหมวด "${name}" อยู่แล้ว` : error.message,
    }
  }

  revalidatePath('/admin/categories')
  revalidatePath('/admin/books/new')
  return { ok: true, message: `เพิ่มหมวด "${name}" แล้ว` }
}

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'ต้องใส่ชื่อหมวดหมู่').max(60, 'ชื่อยาวเกิน 60 ตัวอักษร'),
  sort_order: z.coerce.number().int().min(0).max(9999),
})

/**
 * แก้ชื่อและลำดับ — ตั้งใจไม่แก้ slug ตาม
 *
 * slug ถูกอ้างในลิงก์ที่ลูกค้าอาจเซฟไว้ ถ้าเปลี่ยนตามชื่อทุกครั้ง
 * ลิงก์เก่าจะพังเงียบๆ การพิมพ์ชื่อผิดแล้วมาแก้จึงไม่ควรกระทบใคร
 */
export async function updateCategory(
  _prev: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  await requirePermission('book.write')

  const parsed = renameSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }
  }
  const { id, name, sort_order } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from('categories')
    .update({ name, sort_order })
    .eq('id', id)

  if (error) return { ok: false, message: error.message }

  revalidatePath('/admin/categories')
  revalidatePath('/admin/books')
  return { ok: true, message: 'บันทึกแล้ว' }
}

/**
 * ลบหมวด — เช็คก่อนว่ายังมีหนังสือผูกอยู่ไหม
 *
 * schema ตั้ง on delete set null ไว้ ถ้าปล่อยลบเลยหนังสือจะหลุดหมวดเงียบๆ
 * โดยไม่มีใครรู้ว่าเกิดอะไรขึ้น จึงกันไว้ที่นี่แล้วบอกจำนวนให้ชัด
 */
export async function deleteCategory(id: string): Promise<CategoryState> {
  await requirePermission('book.write')
  const supabase = await createClient()

  const { count, error: countError } = await supabase
    .from('books')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)

  if (countError) return { ok: false, message: countError.message }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `ลบไม่ได้ — ยังมีหนังสือ ${count} เล่มอยู่ในหมวดนี้ ย้ายหมวดให้หนังสือก่อน`,
    }
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/admin/categories')
  revalidatePath('/admin/books/new')
  return { ok: true, message: 'ลบหมวดแล้ว' }
}
