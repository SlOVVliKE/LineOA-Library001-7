'use client'

import { useActionState, useEffect, useState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { Alert } from '@/components/Alert'
import { receiveStockAction, type ActionState } from '../actions'
import { formatBaht } from '@/lib/money'

interface BookOption { id: string; sku: string; title: string }

export function ReceiveForm({ books }: { books: BookOption[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    receiveStockAction, { ok: false })

  const [qty, setQty] = useState(0)
  const [unitCost, setUnitCost] = useState(0)
  const [shippingCost, setShippingCost] = useState(0)


  const landed = qty > 0 ? unitCost + shippingCost / qty : null

  // React ล้างช่องกรอกให้เองเมื่อบันทึกสำเร็จ แต่ตัวเลขที่เรา mirror ไว้ใน state
  // ไม่ถูกล้างตาม กล่อง "ต้นทุนจริงต่อเล่ม" จึงค้างเลขของล็อตที่บันทึกไปแล้ว
  // คนถัดไปที่มากรอกจะเห็นต้นทุนของล็อตเก่าลอยอยู่ ซึ่งชวนให้เข้าใจผิด
  useEffect(() => {
    if (state.ok) {
      setQty(0)
      setUnitCost(0)
      setShippingCost(0)
    }
  }, [state])

  // ค่าที่ส่งกลับมาตอนบันทึกไม่ผ่าน ใช้เติมช่องกลับให้เหมือนเดิม
  const kept = state.values ?? {}

  return (
    <form
      key={state.ok ? 'fresh' : (state.message ?? 'first')}
      action={formAction}
      className="card max-w-2xl space-y-4"
    >
      <Alert ok={state.ok} message={state.message} />

      <div>
        <label className="label">หนังสือ <span className="text-red-500">*</span></label>
        <select name="book_id" required className="input" defaultValue={kept.book_id ?? ''}>
          <option value="" disabled>— เลือกหนังสือ —</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>{b.sku} · {b.title}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">จำนวนที่รับเข้า <span className="text-red-500">*</span></label>
          <input name="qty" type="number" min={1} required className="input"
            defaultValue={kept.qty ?? ''}
            onChange={(e) => setQty(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">ราคาซื้อ/เล่ม (บาท) <span className="text-red-500">*</span></label>
          <input name="unit_cost" type="number" step="0.01" min={0} required className="input"
            defaultValue={kept.unit_cost ?? ''}
            onChange={(e) => setUnitCost(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">ค่าขนส่งขาเข้า (ทั้งล็อต)</label>
          <input name="shipping_cost" type="number" step="0.01" min={0}
            defaultValue={kept.shipping_cost ?? 0} className="input"
            onChange={(e) => setShippingCost(Number(e.target.value))} />
        </div>
      </div>

      {landed !== null && landed > 0 && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
          <div className="text-xs text-teal-800">ต้นทุนจริงต่อเล่มที่จะบันทึก</div>
          <div className="text-xl font-semibold text-teal-900">{formatBaht(landed)}</div>
          <div className="mt-1 text-xs text-teal-700">
            = {formatBaht(unitCost)} + ({formatBaht(shippingCost)} ÷ {qty} เล่ม)
            — ตัวเลขนี้คือต้นทุนที่ใช้คำนวณกำไรตอนขาย
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">ซัพพลายเออร์</label>
          <input name="supplier" className="input" defaultValue={kept.supplier ?? ''} />
        </div>
        <div>
          <label className="label">วันที่ของมาถึง</label>
          <input name="received_at" type="date" className="input"
            defaultValue={kept.received_at ?? new Date().toISOString().slice(0, 10)}
            max={new Date().toISOString().slice(0, 10)} />
          <p className="mt-1 text-xs text-neutral-500">
            ใส่วันที่ของถึงร้านจริง ไม่ใช่วันที่กรอกฟอร์ม — ค่านี้ใช้เรียงลำดับ FIFO
            ระบบจะบันทึกเวลาที่กดบันทึกแยกไว้ให้เองอีกช่อง
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">เลขที่ใบซื้อ</label>
          <input name="invoice_no" className="input" defaultValue={kept.invoice_no ?? ''} />
        </div>
        <div>
          <label className="label">รหัสล็อต</label>
          <input name="lot_no" className="input" defaultValue={kept.lot_no ?? ''} placeholder="เช่น LOT-A" />
        </div>
      </div>

      <div>
        <label className="label">หมายเหตุ</label>
        <textarea name="note" rows={2} className="input" defaultValue={kept.note ?? ''} />
      </div>

      <SubmitButton>บันทึกการรับเข้า</SubmitButton>
    </form>
  )
}
