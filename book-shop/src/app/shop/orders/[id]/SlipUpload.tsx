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
      <input
        type="file"
        name="slip"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required
        className="input file:mr-3 file:rounded file:border-0 file:bg-neutral-100 file:px-3 file:py-1 file:text-sm"
      />
      <Alert ok={state.ok} message={state.message} />
      <SubmitButton>ส่งสลิป</SubmitButton>
    </form>
  )
}
