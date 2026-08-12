'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addToCart } from '../../actions'

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
      <p className="rounded-lg bg-neutral-100 px-4 py-3 text-center text-sm text-neutral-500">
        สินค้าหมด — ติดต่อแอดมินเพื่อสอบถามรอบเข้าถัดไป
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-neutral-300">
          <button
            type="button"
            className="px-3 py-2 text-lg leading-none disabled:opacity-40"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
          >
            −
          </button>
          <span className="w-10 text-center text-sm">{qty}</span>
          <button
            type="button"
            className="px-3 py-2 text-lg leading-none disabled:opacity-40"
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

      {isPreorder && (
        <p className="text-xs text-amber-700">
          สินค้าสั่งจองจะถูกแยกเป็นคำสั่งซื้อคนละใบกับของพร้อมส่ง และคิดค่าส่งแยกกัน
        </p>
      )}

      {msg && (
        <p className={`text-sm ${msg.ok ? 'text-teal-700' : 'text-red-600'}`}>{msg.text}</p>
      )}
    </div>
  )
}
