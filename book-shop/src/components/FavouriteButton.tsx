'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleFavourite } from '@/app/shop/favourites/actions'

/**
 * ปุ่มติดดาว
 *
 * อัปเดตหน้าจอทันทีที่กด (optimistic) แล้วค่อยรอผลจากเซิร์ฟเวอร์
 * ถ้าเซิร์ฟเวอร์ตอบว่าไม่สำเร็จจะย้อนสถานะกลับ — การกดดาวเป็นงานเล็ก
 * ถ้าต้องรอโหลดทุกครั้งจะรู้สึกหน่วงจนไม่อยากกด
 */
export function FavouriteButton({
  bookId,
  initialStarred,
  showLabel = false,
}: {
  bookId: string
  initialStarred: boolean
  showLabel?: boolean
}) {
  const router = useRouter()
  const [starred, setStarred] = useState(initialStarred)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={pending}
        aria-pressed={starred}
        aria-label={starred ? 'เอาออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition
          ${starred
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : 'border-neutral-300 text-neutral-600 hover:border-amber-300 hover:text-amber-700'}
          disabled:opacity-50`}
        onClick={() => {
          const next = !starred
          setStarred(next)
          setError(null)
          startTransition(async () => {
            const res = await toggleFavourite(bookId)
            if (!res.ok) {
              setStarred(!next)
              setError(res.message ?? 'ทำรายการไม่สำเร็จ')
              return
            }
            setStarred(res.starred ?? next)
            router.refresh()
          })
        }}
      >
        <span aria-hidden>{starred ? '★' : '☆'}</span>
        {showLabel && <span>{starred ? 'อยู่ในรายการโปรด' : 'ติดดาวไว้'}</span>}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
