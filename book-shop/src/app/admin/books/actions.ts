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

export type ActionState = { ok: boolean; message?: string; fieldErrors?: Record<string, string> }

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
    return { ok: false, message: 'ข้อมูลไม่ถูกต้อง', fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('books').insert(parsed.data)

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'SKU นี้ถูกใช้ไปแล้ว' }
    return { ok: false, message: error.message }
  }

  revalidatePath('/admin/books')
  redirect('/admin/books')
}

export async function updateBook(id: string, formData: FormData): Promise<ActionState> {
  await requirePermission('book.write')

  const parsed = parseForm(formData)
  if (!parsed.success) return { ok: false, message: 'ข้อมูลไม่ถูกต้อง' }

  const supabase = await createClient()
  const { error } = await supabase.from('books').update(parsed.data).eq('id', id)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/admin/books')
  revalidatePath(`/admin/books/${id}`)
  return { ok: true, message: 'บันทึกแล้ว' }
}

export async function toggleBookActive(id: string, isActive: boolean): Promise<void> {
  await requirePermission('book.write')
  const supabase = await createClient()
  await supabase.from('books').update({ is_active: isActive }).eq('id', id)
  revalidatePath('/admin/books')
}
