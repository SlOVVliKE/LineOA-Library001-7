'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { Alert } from '@/components/Alert'
import type { ActionState } from './actions'

interface Category { id: string; name: string }

export function BookForm({
  action,
  categories,
  defaults,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  categories: Category[]
  defaults?: Record<string, unknown>
}) {
  const [state, formAction] = useActionState(action, { ok: false })
  const d = defaults ?? {}
  const v = (k: string) => (d[k] === null || d[k] === undefined ? '' : String(d[k]))

  return (
    <form action={formAction} className="card max-w-2xl space-y-4">
      <Alert ok={state.ok} message={state.message} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU (รหัสภายใน)" name="sku" defaultValue={v('sku')} required
          hint="ใช้ผูกกับรายการใน Shopee/Lazada — ตั้งแล้วไม่ควรเปลี่ยน"
          error={state.fieldErrors?.sku} />
        <Field label="ISBN" name="isbn" defaultValue={v('isbn')} />
      </div>

      <Field label="ชื่อหนังสือ" name="title" defaultValue={v('title')} required
        error={state.fieldErrors?.title} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ผู้แต่ง" name="author" defaultValue={v('author')} />
        <Field label="สำนักพิมพ์" name="publisher" defaultValue={v('publisher')} />
      </div>

      <div>
        <label className="label">หมวดหมู่</label>
        <select name="category_id" defaultValue={v('category_id')} className="input">
          <option value="">— ไม่ระบุ —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="ราคาขาย (บาท)" name="sell_price" type="number" step="0.01"
          defaultValue={v('sell_price')} required error={state.fieldErrors?.sell_price} />
        <Field label="น้ำหนัก (กรัม)" name="weight_grams" type="number"
          defaultValue={v('weight_grams') || '300'} required
          hint="ใช้คำนวณค่าส่งจริงและเผื่อเปลี่ยนไปคิดตามน้ำหนัก" />
        <Field label="จำนวนหน้า" name="page_count" type="number" defaultValue={v('page_count')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">โหมดการขาย</label>
          <select name="stock_mode" defaultValue={v('stock_mode') || 'stock'} className="input">
            <option value="stock">พร้อมส่ง</option>
            <option value="preorder">เปิดจอง (pre-order)</option>
            <option value="backorder">หมดชั่วคราว รับสั่งจอง</option>
          </select>
        </div>
        <Field label="จุดสั่งซื้อ" name="reorder_point" type="number"
          defaultValue={v('reorder_point') || '3'} hint="เหลือต่ำกว่านี้จะแจ้งเตือน" />
        <Field label="กันชนหลายช่องทาง" name="safety_buffer" type="number"
          defaultValue={v('safety_buffer') || '1'} hint="กันขายเกินตอน sync ช้า" />
      </div>

      <Field label="วันที่ของเข้า (เฉพาะ pre-order)" name="preorder_release_date" type="date"
        defaultValue={v('preorder_release_date')} />

      <div>
        <label className="label">เรื่องย่อ</label>
        <textarea name="description" rows={4} defaultValue={v('description')} className="input" />
      </div>

      <SubmitButton>บันทึก</SubmitButton>
    </form>
  )
}

function Field({
  label, name, type = 'text', defaultValue, required, hint, error, step,
}: {
  label: string; name: string; type?: string; defaultValue?: string
  required?: boolean; hint?: string; error?: string; step?: string
}) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input className="input" name={name} type={type} step={step}
        defaultValue={defaultValue} required={required} />
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
