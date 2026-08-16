'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'

const bookSchema = z.object({
  sku: z.string().min(1, 'ต้องระบุ SKU').max(40),
  isbn: z.string().max(20).optional().nullable(),
  title: z.string().min(1, 'ต้องระบุชื่อหนังสือ'),
  author: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  sell_price: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
  weight_grams: z.coerce.number().int().min(1, 'ต้องระบุน้ำหนัก'),
  page_count: z.coerce.number().int().min(0).optional().nullable(),
  reorder_point: z.coerce.number().int().min(0).default(3),
  safety_buffer: z.coerce.number().int().min(0).default(1),
  stock_mode: z.enum(['stock', 'preorder', 'backorder']).default('stock'),
  preorder_release_date: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

/**
 * `values` คือสิ่งที่ผู้ใช้เพิ่งกรอก ส่งกลับไปเติมฟอร์มเมื่อบันทึกไม่ผ่าน
 * React 19 ล้างช่องให้เองทุกครั้งหลัง action จบ ถ้าไม่ส่งคืน คนกรอกจะเสีย
 * ทั้งชื่อเรื่อง ผู้แต่ง ราคา และเรื่องย่อที่พิมพ์มายาว เพราะ SKU ซ้ำแค่ตัวเดียว
 */
export type ActionState = {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

/** เก็บสิ่งที่ผู้ใช้กรอกไว้คืนฟอร์มตอนบันทึกไม่ผ่าน */
function keepInput(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of formData.entries()) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  const cleaned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    cleaned[k] = v === '' ? null : v
  }
  return bookSchema.safeParse(cleaned)
}

export async function createBook(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission('book.write')

  const parsed = parseForm(formData)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message
    }
    return { ok: false, message: 'ข้อมูลไม่ถูกต้อง', fieldErrors, values: keepInput(formData) }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('books').insert(parsed.data)

  if (error) {
    const values = keepInput(formData)
    if (error.code === '23505') return { ok: false, message: 'SKU นี้ถูกใช้ไปแล้ว', values }
    return { ok: false, message: error.message, values }
  }

  revalidatePath('/admin/books')
  redirect('/admin/books')
}

/**
 * ลำดับพารามิเตอร์เป็น (id, prev, formData) เพื่อให้ .bind(null, id) แล้วได้
 * ฟังก์ชันหน้าตาตรงกับที่ useActionState ต้องการพอดี
 */
export async function updateBook(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission('book.write')

  const parsed = parseForm(formData)
  if (!parsed.success) return { ok: false, message: 'ข้อมูลไม่ถูกต้อง', values: keepInput(formData) }

  const supabase = await createClient()
  const { error } = await supabase.from('books').update(parsed.data).eq('id', id)
  if (error) return { ok: false, message: error.message, values: keepInput(formData) }

  revalidatePath('/admin/books')
  revalidatePath(`/admin/books/${id}`)
  return { ok: true, message: 'บันทึกแล้ว' }
}

/**
 * เปิด/ปิดการขาย
 *
 * ปิดแทนการลบเสมอ เพราะออเดอร์เก่าอ้างถึงหนังสือเล่มนี้อยู่
 * ลบทิ้งแล้วประวัติการขายและรายงานกำไรย้อนหลังจะขาดหายไป
 */
export async function toggleBookActive(id: string, isActive: boolean): Promise<ActionState> {
  await requirePermission('book.write')
  const supabase = await createClient()
  const { error } = await supabase.from('books').update({ is_active: isActive }).eq('id', id)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/admin/books')
  revalidatePath(`/admin/books/${id}`)
  revalidatePath('/shop')
  return { ok: true, message: isActive ? 'เปิดขายแล้ว' : 'ปิดการขายแล้ว ลูกค้าจะไม่เห็นเล่มนี้ที่หน้าร้าน' }
}
