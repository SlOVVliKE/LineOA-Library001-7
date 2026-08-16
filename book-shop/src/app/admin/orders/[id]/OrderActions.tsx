'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  verifyPayment, markShipped, cancelOrder, getSlipUrl, confirmPaidWithoutSlip,
  type OrderActionState,
} from '../actions'
import { SubmitButton } from '@/components/SubmitButton'
import { Alert } from '@/components/Alert'

type Props =
  | { mode: 'verify'; orderId: string; paymentId: string; slipPath: string | null; disabled?: boolean }
  | { mode: 'ship'; orderId: string }
  | { mode: 'cancel'; orderId: string }
  | { mode: 'manual-paid'; orderId: string; amountLabel: string }

export function OrderActions(props: Props) {
  if (props.mode === 'verify') return <VerifyBlock {...props} />
  if (props.mode === 'ship') return <ShipBlock orderId={props.orderId} />
  if (props.mode === 'manual-paid') return <ManualPaidBlock {...props} />
  return <CancelBlock orderId={props.orderId} />
}

/**
 * รับเงินโดยไม่มีสลิป — ใช้ตอนลูกค้าโอนแล้วทักมาบอกในแชท หรือจ่ายเงินสด
 * ซ่อนไว้หลังปุ่มสองชั้นเพราะข้ามการตรวจหลักฐาน ไม่ควรกดพลาด
 */
function ManualPaidBlock({ orderId, amountLabel }: { orderId: string; amountLabel: string }) {
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

function VerifyBlock({
  orderId, paymentId, slipPath, disabled,
}: {
  orderId: string; paymentId: string; slipPath: string | null; disabled?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<OrderActionState | null>(null)
  const [slipUrl, setSlipUrl] = useState<string | null>(null)

  function act(approve: boolean) {
    startTransition(async () => {
      const res = await verifyPayment(paymentId, orderId, approve)
      setMsg(res)
      if (res.ok) router.refresh()
    })
  }

  function openSlip() {
    startTransition(async () => {
      if (!slipPath) return
      const url = await getSlipUrl(slipPath)
      setSlipUrl(url)
    })
  }

  return (
    <div className="mt-3 space-y-2">
      {slipPath && !slipUrl && (
        <button className="btn-ghost w-full" onClick={openSlip} disabled={pending}>
          ดูสลิป
        </button>
      )}
      {slipUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slipUrl} alt="สลิป" className="w-full rounded-lg border border-neutral-200" />
      )}

      <Alert ok={msg?.ok} message={msg?.message} />

      {!disabled && (
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={() => act(true)} disabled={pending}>
            {pending ? 'กำลังทำงาน...' : 'ยืนยันการชำระเงิน'}
          </button>
          <button className="btn-ghost" onClick={() => act(false)} disabled={pending}>
            ปฏิเสธ
          </button>
        </div>
      )}

      {!disabled && (
        <p className="text-xs text-neutral-500">
          กดยืนยันแล้วระบบจะตัดสต็อกแบบ FIFO ล็อกต้นทุนลงในออเดอร์ และออกใบเสร็จให้อัตโนมัติ
          — ตรวจให้แน่ใจก่อนว่ายอดในสลิปตรงกับยอดที่ต้องโอน
        </p>
      )}
    </div>
  )
}

function ShipBlock({ orderId }: { orderId: string }) {
  const [state, formAction] = useActionState<OrderActionState, FormData>(markShipped, { ok: false })

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <Alert ok={state.ok} message={state.message} />

      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>

      <p className="text-xs text-neutral-500">
        กรอกค่าส่งจริงทุกครั้ง เพื่อให้รายงานส่วนต่างค่าส่งเชื่อถือได้
        (เก็บลูกค้า 40 บาท แต่จ่ายจริงเท่าไหร่)
      </p>

      <SubmitButton>บันทึกการจัดส่ง</SubmitButton>
    </form>
  )
}

function CancelBlock({ orderId }: { orderId: string }) {
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
