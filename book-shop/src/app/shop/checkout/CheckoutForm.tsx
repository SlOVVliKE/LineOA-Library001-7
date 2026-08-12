'use client'

import { useActionState } from 'react'
import { createOrders, type ShopState } from '../actions'
import { SubmitButton } from '@/components/SubmitButton'
import { Alert } from '@/components/Alert'

interface Defaults {
  recipient_name: string
  phone: string
  line1: string
  subdistrict: string
  district: string
  province: string
  postcode: string
}

export function CheckoutForm({ defaults }: { defaults?: Defaults }) {
  const [state, formAction] = useActionState<ShopState, FormData>(createOrders, { ok: false })

  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="font-medium">ที่อยู่จัดส่ง</h2>
      <Alert ok={state.ok} message={state.message} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อผู้รับ" name="recipient_name" required defaultValue={defaults?.recipient_name} />
        <Field label="เบอร์โทร" name="phone" required type="tel" defaultValue={defaults?.phone} />
      </div>

      <Field label="ที่อยู่ (บ้านเลขที่ ถนน)" name="line1" required defaultValue={defaults?.line1} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ตำบล/แขวง" name="subdistrict" defaultValue={defaults?.subdistrict} />
        <Field label="อำเภอ/เขต" name="district" defaultValue={defaults?.district} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="จังหวัด" name="province" required defaultValue={defaults?.province} />
        <Field
          label="รหัสไปรษณีย์"
          name="postcode"
          required
          inputMode="numeric"
          maxLength={5}
          defaultValue={defaults?.postcode}
        />
      </div>

      <div>
        <label className="label">ขนส่ง</label>
        <select name="carrier" className="input" defaultValue="flash">
          <option value="flash">Flash Express (ประมาณ 2 วัน)</option>
          <option value="jnt">J&amp;T Express (ประมาณ 3 วัน)</option>
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          ค่าส่งเท่ากันทั้งสองเจ้า — เลือกตามความสะดวกในการรับของ
        </p>
      </div>

      <div>
        <label className="label">หมายเหตุถึงร้าน</label>
        <textarea name="customer_note" rows={2} className="input" />
      </div>

      <SubmitButton>สั่งซื้อและไปหน้าชำระเงิน</SubmitButton>

      <p className="text-xs text-neutral-500">
        เมื่อกดสั่งซื้อ ระบบจะจองสินค้าไว้ให้ 30 นาที
        หากยังไม่ได้ชำระเงินภายในเวลานี้ สินค้าจะถูกปล่อยคืนให้ลูกค้าคนอื่น
      </p>
    </form>
  )
}

function Field({
  label, name, required, type = 'text', defaultValue, inputMode, maxLength,
}: {
  label: string; name: string; required?: boolean; type?: string
  defaultValue?: string; inputMode?: 'numeric' | 'text'; maxLength?: number
}) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        className="input"
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        inputMode={inputMode}
        maxLength={maxLength}
      />
    </div>
  )
}
