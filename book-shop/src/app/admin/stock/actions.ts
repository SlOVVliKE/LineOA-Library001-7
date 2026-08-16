'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { receiveStock, adjustStock } from '@/lib/inventory/fifo'
import { drainNotificationsSafely } from '@/lib/line/notify'

/**
 * `values` คือค่าที่ผู้ใช้เพิ่งกรอกส่งกลับไป
 *
 * React 19 ล้างช่องในฟอร์มให้เองหลังจาก action ทำงานจบ ไม่ว่าจะสำเร็จหรือไม่
 * ถ้าไม่ส่งค่ากลับไป พอบันทึกไม่ผ่าน (เช่นสต็อกไม่พอ) ผู้ใช้จะเสียทุกอย่างที่พิมพ์
 * ต้องเลือกหนังสือ ใส่จำนวน และพิมพ์เหตุผลใหม่ทั้งหมดเพียงเพราะพิมพ์ตัวเลขผิดตัวเดียว
 */
export type ActionState = {
  ok: boolean
  message?: string
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

const receiveSchema = z.object({
  book_id: z.string().uuid('ต้องเลือกหนังสือ'),
  qty: z.coerce.number().int().positive('จำนวนต้องมากกว่า 0'),
  unit_cost: z.coerce.number().min(0, 'ต้นทุนต้องไม่ติดลบ'),
  shipping_cost: z.coerce.number().min(0).default(0),
  supplier: z.string().optional().nullable(),
  received_at: z.string().optional().nullable(),
  invoice_no: z.string().optional().nullable(),
  lot_no: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

export async function receiveStockAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePermission('lot.write')

  const raw = Object.fromEntries(formData.entries())
  const cleaned = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v === '' ? undefined : v])
  )
  const parsed = receiveSchema.safeParse(cleaned)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
      values: keepInput(formData),
    }
  }

  const d = parsed.data
  const supabase = await createClient()

  try {
    await receiveStock(supabase, {
      bookId: d.book_id,
      qty: d.qty,
      unitCost: d.unit_cost,
      shippingCost: d.shipping_cost,
      supplier: d.supplier ?? null,
      receivedAt: d.received_at ?? null,
      invoiceNo: d.invoice_no ?? null,
      lotNo: d.lot_no ?? null,
      note: d.note ?? null,
      createdBy: user.id,
    })
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ',
      values: keepInput(formData),
    }
  }

  // รับของเข้าอาจจ่ายคิวสั่งจองให้อัตโนมัติ → มีแจ้งเตือน "ของที่จองเข้าแล้ว" รออยู่ในคิว
  await drainNotificationsSafely(50)

  const landed = d.unit_cost + d.shipping_cost / d.qty
  revalidatePath('/admin/stock')
  revalidatePath('/admin')
  return {
    ok: true,
    message: `รับเข้า ${d.qty} เล่ม ต้นทุนจริง ${landed.toFixed(2)} บาท/เล่ม`,
  }
}

const adjustSchema = z.object({
  book_id: z.string().uuid('ต้องเลือกหนังสือ'),
  qty_delta: z.coerce.number().int().refine((n) => n !== 0, 'จำนวนต้องไม่เป็น 0'),
  reason: z.string().min(3, 'ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร'),
  type: z.enum(['adjust', 'damage', 'return', 'channel_correction']).default('adjust'),
})

export async function adjustStockAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePermission('lot.write')

  const parsed = adjustSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง',
      values: keepInput(formData),
    }
  }

  const supabase = await createClient()
  try {
    await adjustStock(supabase, {
      bookId: parsed.data.book_id,
      qtyDelta: parsed.data.qty_delta,
      reason: parsed.data.reason,
      type: parsed.data.type,
      createdBy: user.id,
    })
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'ปรับสต็อกไม่สำเร็จ',
      values: keepInput(formData),
    }
  }

  revalidatePath('/admin/stock')
  revalidatePath('/admin')
  return { ok: true, message: 'ปรับสต็อกเรียบร้อย' }
}
