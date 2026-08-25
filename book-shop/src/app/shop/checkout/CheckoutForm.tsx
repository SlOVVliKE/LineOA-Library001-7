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
    <form action={formAction} className="space-y-3">
      <section className="card space-y-3.5">
        <div className="flex items-baseline justify-between">
          <h2 className="t-heading">ที่อยู่จัดส่ง</h2>
          {defaults && <span className="t-micro">กรอกจากครั้งล่าสุดให้แล้ว</span>}
        </div>

        <Alert ok={state.ok} message={state.message} />

        {/* ช่องกรอกเรียงบรรทัดละหนึ่งช่องบนมือถือ ไม่แบ่งครึ่งจอ
            สองช่องต่อแถวทำให้แต่ละช่องแคบจนชื่อยาวๆ เลื่อนหายไปทางขวา
            และคนกรอกที่อยู่มักถือมือถือมือเดียว การไล่ลงตรงๆ พลาดยากกว่า */}
        <Field
          label="ชื่อผู้รับ"
          name="recipient_name"
          required
          autoComplete="name"
          defaultValue={defaults?.recipient_name}
        />
        <Field
          label="เบอร์โทร"
          name="phone"
          required
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          defaultValue={defaults?.phone}
        />
        <Field
          label="ที่อยู่ (บ้านเลขที่ ถนน)"
          name="line1"
          required
          autoComplete="street-address"
          defaultValue={defaults?.line1}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ตำบล/แขวง" name="subdistrict" defaultValue={defaults?.subdistrict} />
          <Field label="อำเภอ/เขต" name="district" defaultValue={defaults?.district} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="จังหวัด"
            name="province"
            required
            autoComplete="address-level1"
            defaultValue={defaults?.province}
          />
          <Field
            label="รหัสไปรษณีย์"
            name="postcode"
            required
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            defaultValue={defaults?.postcode}
          />
        </div>
      </section>

      <section className="card space-y-3.5">
        <h2 className="t-heading">ขนส่งและหมายเหตุ</h2>

        <div>
          <label className="label" htmlFor="carrier">ขนส่ง</label>
          <select id="carrier" name="carrier" className="input" defaultValue="flash">
            <option value="flash">Flash Express (ประมาณ 2 วัน)</option>
            <option value="jnt">J&amp;T Express (ประมาณ 3 วัน)</option>
          </select>
          <p className="t-micro mt-1.5">
            ค่าส่งเท่ากันทั้งสองเจ้า เลือกตามความสะดวกในการรับของ
          </p>
        </div>

        <div>
          <label className="label" htmlFor="customer_note">หมายเหตุถึงร้าน</label>
          <textarea
            id="customer_note"
            name="customer_note"
            rows={2}
            className="input"
            placeholder="เช่น ฝากไว้ที่ป้อมยาม"
          />
        </div>
      </section>

      <p
        className="rounded-xl px-3.5 py-2.5 text-[13px]"
        style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}
      >
        เมื่อกดสั่งซื้อ ระบบจะจองสินค้าไว้ให้ 30 นาที
        หากยังไม่ได้ชำระเงินภายในเวลานี้ สินค้าจะถูกปล่อยคืนให้ลูกค้าคนอื่น
      </p>

      <div className="dock -mx-4">
        <div className="mx-auto max-w-3xl">
          <SubmitButton className="btn-primary w-full">
            สั่งซื้อและไปหน้าชำระเงิน
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}

function Field({
  label, name, required, type = 'text', defaultValue, inputMode, maxLength, autoComplete,
}: {
  label: string; name: string; required?: boolean; type?: string
  defaultValue?: string; inputMode?: 'numeric' | 'text'; maxLength?: number
  autoComplete?: string
}) {
  return (
    <div>
      {/* ผูก label กับ input ด้วย htmlFor/id — แตะที่ป้ายแล้วเคอร์เซอร์เข้าช่องเลย
          เพิ่มพื้นที่แตะให้แต่ละช่องโดยไม่ต้องขยายอะไร */}
      <label className="label" htmlFor={name}>
        {label}
        {required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      <input
        id={name}
        className="input"
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
      />
    </div>
  )
}
