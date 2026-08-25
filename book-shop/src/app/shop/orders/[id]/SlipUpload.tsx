'use client'

import { useActionState } from 'react'
import { uploadSlip, type ShopState } from '../../actions'
import { SubmitButton } from '@/components/SubmitButton'
import { Alert } from '@/components/Alert'

export function SlipUpload({
  orderId,
  purpose = 'full',
}: {
  orderId: string
  purpose?: 'full' | 'balance'
}) {
  const [state, formAction] = useActionState<ShopState, FormData>(uploadSlip, { ok: false })

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="purpose" value={purpose} />
      <label className="label">แนบสลิปโอนเงิน</label>
      {/* ปุ่มเลือกไฟล์ที่เบราว์เซอร์สร้างให้เองมักเล็กและหน้าตาไม่เหมือนปุ่มอื่นในหน้า
          จัดสไตล์ผ่าน ::file-selector-button ให้สูงพอแตะและกลืนกับปุ่มที่เหลือ */}
      <input
        type="file"
        name="slip"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required
        className="input file-input flex items-center py-2.5 text-[14px]"
      />
      <Alert ok={state.ok} message={state.message} />
      <SubmitButton>ส่งสลิป</SubmitButton>
    </form>
  )
}
