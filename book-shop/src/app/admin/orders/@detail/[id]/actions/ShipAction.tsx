'use client'

import { useActionState } from 'react'
import { markShipped, type OrderActionState } from '../../../actions'
import { SubmitButton } from '@/components/SubmitButton'
import { Alert } from '@/components/Alert'

export function ShipAction({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState<OrderActionState, FormData>(markShipped, { ok: false })

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <Alert ok={state.ok} message={state.message} />

      <div>
        <label className="label">ขนส่ง</label>
        <select name="carrier" className="input" defaultValue="flash">
          <option value="flash">Flash Express</option>
          <option value="jnt">J&amp;T Express</option>
        </select>
      </div>
      <div>
        <label className="label">เลขพัสดุ</label>
        <input name="tracking_no" className="input" required />
      </div>
      <div>
        <label className="label">ค่าส่งจริงที่จ่าย</label>
        <input name="actual_cost" type="number" step="0.01" min={0} className="input" />
      </div>

      <p className="text-xs text-neutral-500">
        กรอกค่าส่งจริงทุกครั้ง เพื่อให้รายงานส่วนต่างค่าส่งเชื่อถือได้
        (เก็บลูกค้า 40 บาท แต่จ่ายจริงเท่าไหร่)
      </p>

      <SubmitButton>บันทึกการจัดส่ง</SubmitButton>
    </form>
  )
}
