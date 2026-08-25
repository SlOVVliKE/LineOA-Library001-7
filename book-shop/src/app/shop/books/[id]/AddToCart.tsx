'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addToCart } from '../../actions'
import { Alert } from '@/components/Alert'

/**
 * ตัวเลือกจำนวนและปุ่มใส่ตะกร้า
 *
 * วางไว้ในแถบติดขอบล่างจอ (ดูคลาส .dock) ไม่ใช่กลางหน้า
 * เพราะหน้ารายละเอียดมีเรื่องย่อกับตารางข้อมูลที่ทำให้ต้องเลื่อนยาว
 * ถ้าปุ่มซื้ออยู่กลางหน้า ลูกค้าที่อ่านเรื่องย่อจบแล้วอยากซื้อ
 * ต้องเลื่อนกลับขึ้นไปหา ซึ่งเป็นจังหวะที่คนเปลี่ยนใจได้ง่ายที่สุด
 */
export function AddToCart({
  bookId,
  max,
  disabled,
  isPreorder,
}: {
  bookId: string
  max: number
  disabled?: boolean
  isPreorder?: boolean
}) {
  const router = useRouter()
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await addToCart(bookId, qty)
      setMsg({ ok: res.ok, text: res.message ?? '' })
      if (res.ok) router.refresh()
    })
  }

  if (disabled) {
    return (
      <p
        className="rounded-xl px-4 py-3.5 text-center text-[14px]"
        style={{ background: 'var(--paper-sunken)', color: 'var(--ink-muted)' }}
      >
        สินค้าหมด — ติดดาวไว้ แล้วเราจะแจ้งเมื่อของเข้า
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {msg && <Alert ok={msg.ok} message={msg.text} />}

      <div className="flex items-stretch gap-2.5">
        {/* ปุ่มบวกลบขนาด 48px เท่าปุ่มหลัก
            ของเดิมสูงราว 36px ซึ่งเล็กกว่าระยะที่นิ้วแตะได้แม่น
            และมักโดนกดพลาดเป็นปุ่มข้างๆ เพราะสองปุ่มติดกัน */}
        <div
          className="flex shrink-0 items-center rounded-xl border"
          style={{ borderColor: 'var(--line-strong)' }}
        >
          <button
            type="button"
            aria-label="ลดจำนวน"
            className="h-12 w-12 text-xl leading-none transition active:scale-90 disabled:opacity-30"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
          >
            −
          </button>
          <span className="tabular w-9 text-center text-[16px]" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            aria-label="เพิ่มจำนวน"
            className="h-12 w-12 text-xl leading-none transition active:scale-90 disabled:opacity-30"
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            disabled={qty >= max}
          >
            +
          </button>
        </div>

        <button className="btn-primary flex-1" onClick={submit} disabled={pending}>
          {pending ? 'กำลังใส่...' : isPreorder ? 'สั่งจองล่วงหน้า' : 'ใส่ตะกร้า'}
        </button>
      </div>
    </div>
  )
}
