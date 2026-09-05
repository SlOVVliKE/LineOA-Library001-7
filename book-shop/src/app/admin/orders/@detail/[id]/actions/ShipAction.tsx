'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  markShipped, quoteShippopRates, bookShippopShipment,
  type OrderActionState, type ShippopQuoteState,
} from '../../../actions'
import { SubmitButton } from '@/components/SubmitButton'
import { Alert } from '@/components/Alert'
import { formatBaht } from '@/lib/money'

export function ShipAction({ orderId, shippopReady }: { orderId: string; shippopReady: boolean }) {
  const [state, formAction] = useActionState<OrderActionState, FormData>(markShipped, { ok: false })

  // เลขพัสดุเป็น controlled input เพราะปุ่ม ShipPop ต้องเติมค่าให้ได้
  // แต่แอดมินก็ยังพิมพ์เองได้เหมือนเดิม (ช่องนี้ไม่เคยถูกล็อก)
  const [trackingNo, setTrackingNo] = useState('')
  const [carrier, setCarrier] = useState('flash')

  const [quotes, setQuotes] = useState<ShippopQuoteState['quotes']>()
  const [courierCode, setCourierCode] = useState('')
  const [shippopMessage, setShippopMessage] = useState<{ ok: boolean; text: string }>()
  const [pending, startTransition] = useTransition()

  function checkRates() {
    setShippopMessage(undefined)
    startTransition(async () => {
      const result = await quoteShippopRates(orderId)
      if (!result.ok) {
        setShippopMessage({ ok: false, text: result.message ?? 'เช็คราคาไม่สำเร็จ' })
        return
      }
      setQuotes(result.quotes)
      setCourierCode(result.quotes?.[0]?.courierCode ?? '')
    })
  }

  function book() {
    setShippopMessage(undefined)
    startTransition(async () => {
      const result = await bookShippopShipment(orderId, courierCode)
      setShippopMessage({ ok: result.ok, text: result.message ?? '' })
      // จองสำเร็จแล้วเติมเลขให้เลย แอดมินแค่กดบันทึกต่อ
      // (กรณีบันทึกฐานข้อมูลพลาด result.ok=false แต่ยังมีเลขมาให้กรอกเอง)
      if (result.trackingNo) {
        setTrackingNo(result.trackingNo)
        setCarrier('shippop')
      }
    })
  }

  return (
    <div className="space-y-3">
      {shippopReady && (
        <div className="space-y-2 rounded-lg border p-3" style={{ borderColor: 'var(--line)' }}>
          <div className="text-sm font-medium">ดึงเลขพัสดุจาก ShipPop</div>

          {shippopMessage && <Alert ok={shippopMessage.ok} message={shippopMessage.text} />}

          {!quotes ? (
            <>
              <button
                type="button"
                onClick={checkRates}
                disabled={pending}
                className="btn btn-ghost w-full"
              >
                {pending ? 'กำลังเช็คราคา…' : 'เช็คราคาขนส่ง'}
              </button>
              <p className="text-xs text-neutral-500">
                เช็คราคาไม่เสียเงินและไม่ผูกมัด กดดูก่อนได้
              </p>
            </>
          ) : (
            <>
              <div>
                <label className="label">เลือกขนส่ง</label>
                <select
                  className="input"
                  value={courierCode}
                  onChange={(e) => setCourierCode(e.target.value)}
                >
                  {quotes.map((q) => (
                    <option key={q.courierCode} value={q.courierCode}>
                      {q.courierName} · {formatBaht(q.price)}
                      {q.estimateTime ? ` · ${q.estimateTime}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={book}
                disabled={pending || !courierCode}
                className="btn btn-ghost w-full"
              >
                {pending ? 'กำลังจอง…' : 'จองและดึงเลขพัสดุ'}
              </button>
              <p className="text-xs text-neutral-500">
                กดแล้วจองจริงกับ ShipPop ทันที — ยกเลิกต้องไปทำในระบบ ShipPop
              </p>
            </>
          )}
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="order_id" value={orderId} />
        <Alert ok={state.ok} message={state.message} />

        <div>
          <label className="label">ขนส่ง</label>
          <select
            name="carrier"
            className="input"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          >
            <option value="flash">Flash Express</option>
            <option value="jnt">J&amp;T Express</option>
            <option value="shippop">ShipPop</option>
          </select>
        </div>
        <div>
          <label className="label">เลขพัสดุ</label>
          <input
            name="tracking_no"
            className="input"
            required
            value={trackingNo}
            onChange={(e) => setTrackingNo(e.target.value)}
          />
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
    </div>
  )
}
