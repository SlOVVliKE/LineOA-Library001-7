'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirmPaidWithoutSlip, type OrderActionState } from '../../../actions'
import { Alert } from '@/components/Alert'

/**
 * รับเงินโดยไม่มีสลิป — ใช้ตอนลูกค้าโอนแล้วทักมาบอกในแชท หรือจ่ายเงินสด
 * ซ่อนไว้หลังปุ่มสองชั้นเพราะข้ามการตรวจหลักฐาน ไม่ควรกดพลาด
 */
export function ManualPaidAction({ orderId, amountLabel }: { orderId: string; amountLabel: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<OrderActionState | null>(null)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  return (
    <div className="space-y-2">
      <Alert ok={msg?.ok} message={msg?.message} />
      {!open ? (
        <button className="btn-ghost w-full" onClick={() => setOpen(true)}>
          รับเงินเองโดยไม่มีสลิป
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600">
            บันทึกว่ารับเงิน <strong>{amountLabel}</strong> แล้ว
            ระบบจะตัดสต็อกและออกใบเสร็จเหมือนยืนยันสลิปปกติ
            — ตรวจยอดเข้าบัญชีให้แน่ใจก่อน เพราะขั้นตอนนี้ข้ามการตรวจหลักฐาน
          </p>
          <input
            className="input"
            placeholder="เหตุผล เช่น โอนแล้วแจ้งในแชท / จ่ายเงินสดหน้าร้าน"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await confirmPaidWithoutSlip(orderId, note)
                  setMsg(res)
                  if (res.ok) {
                    setOpen(false)
                    router.refresh()
                  }
                })
              }
            >
              {pending ? 'กำลังทำงาน...' : 'ยืนยันว่ารับเงินแล้ว'}
            </button>
            <button className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
