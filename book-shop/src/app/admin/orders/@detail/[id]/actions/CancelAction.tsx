'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelOrder, type OrderActionState } from '../../../actions'
import { Alert } from '@/components/Alert'

export function CancelAction({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<OrderActionState | null>(null)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="space-y-2">
      <Alert ok={msg?.ok} message={msg?.message} />
      {!confirming ? (
        <button className="btn-ghost w-full text-red-600" onClick={() => setConfirming(true)}>
          ยกเลิกคำสั่งซื้อ
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600">ยืนยันยกเลิก? สินค้าที่จองไว้จะถูกปล่อยคืน</p>
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await cancelOrder(orderId)
                  setMsg(res)
                  setConfirming(false)
                  if (res.ok) router.refresh()
                })
              }
            >
              ยืนยันยกเลิก
            </button>
            <button className="btn-ghost" onClick={() => setConfirming(false)}>
              ไม่ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
