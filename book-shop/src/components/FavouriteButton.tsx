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
 *
 * ดาวเป็น SVG ไม่ใช่ตัวอักษร ★ ☆
 * เพราะสองตัวนั้นกว้างไม่เท่ากันในหลายฟอนต์ ปุ่มจะขยับตอนสลับสถานะ
 * และบางเครื่องเรนเดอร์เป็นอีโมจิสีเหลืองซึ่งคุมสีไม่ได้
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
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5
                   text-[14px] transition active:scale-95 disabled:opacity-50"
        style={
          starred
            ? { background: 'var(--warn-bg)', borderColor: 'var(--warn-bg)', color: 'var(--warn)' }
            : {
                background: 'var(--paper-raised)',
                borderColor: 'var(--line-strong)',
                color: 'var(--ink-muted)',
              }
        }
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
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill={starred ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
        </svg>
        {showLabel && <span>{starred ? 'อยู่ในรายการโปรด' : 'ติดดาวไว้'}</span>}
      </button>
      {error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  )
}
