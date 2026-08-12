'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { Alert } from '@/components/Alert'
import { adjustStockAction, type ActionState } from '../actions'

interface Row { book_id: string; sku: string; title: string; on_hand: number }

export function AdjustForm({ books }: { books: Row[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    adjustStockAction, { ok: false })

  return (
    <form action={formAction} className="card max-w-2xl space-y-4">
      <Alert ok={state.ok} message={state.message} />

      <div>
        <label className="label">หนังสือ <span className="text-red-500">*</span></label>
        <select name="book_id" required className="input" defaultValue="">
          <option value="" disabled>— เลือกหนังสือ —</option>
          {books.map((b) => (
            <option key={b.book_id} value={b.book_id}>
              {b.sku} · {b.title} (คงเหลือ {b.on_hand})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">จำนวนที่ปรับ <span className="text-red-500">*</span></label>
          <input name="qty_delta" type="number" required className="input" placeholder="เช่น -2 หรือ 5" />
          <p className="mt-1 text-xs text-neutral-500">
            ใส่จำนวนติดลบเพื่อลดสต็อก · ระบบจะตัดจากล็อตเก่าสุดก่อน (FIFO)
          </p>
        </div>
        <div>
          <label className="label">ประเภท</label>
          <select name="type" className="input" defaultValue="adjust">
            <option value="adjust">ปรับจากการตรวจนับ</option>
            <option value="damage">ของเสีย / ชำรุด</option>
            <option value="return">รับคืนจากลูกค้า</option>
            <option value="channel_correction">แก้ไขจากช่องทางขายอื่น</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">เหตุผล <span className="text-red-500">*</span></label>
        <textarea name="reason" rows={2} required className="input"
          placeholder="เช่น ตรวจนับประจำเดือน ส.ค. พบขาด 2 เล่ม" />
      </div>

      <SubmitButton>บันทึกการปรับสต็อก</SubmitButton>
    </form>
  )
}
