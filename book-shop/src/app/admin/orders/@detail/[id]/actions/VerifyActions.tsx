'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { verifyPayment, type OrderActionState } from '../../../actions'
import { Alert } from '@/components/Alert'

/** ปุ่มยืนยัน/ปฏิเสธการชำระเงิน — แยกจาก VerifySlip (ดูหลักฐาน) เพราะเป็นคนละงาน */
export function VerifyActions({
  orderId, paymentId,
}: {
  orderId: string; paymentId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<OrderActionState | null>(null)

  function act(approve: boolean) {
    startTransition(async () => {
      const res = await verifyPayment(paymentId, orderId, approve)
      setMsg(res)
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <Alert ok={msg?.ok} message={msg?.message} />
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={() => act(true)} disabled={pending}>
          {pending ? 'กำลังทำงาน...' : 'ยืนยันการชำระเงิน'}
        </button>
        <button className="btn-ghost" onClick={() => act(false)} disabled={pending}>
          ปฏิเสธ
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        กดยืนยันแล้วระบบจะตัดสต็อกแบบ FIFO ล็อกต้นทุนลงในออเดอร์ และออกใบเสร็จให้อัตโนมัติ
        — ตรวจให้แน่ใจก่อนว่ายอดในสลิปตรงกับยอดที่ต้องโอน
      </p>
    </div>
  )
}
