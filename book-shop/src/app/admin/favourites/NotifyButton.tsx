'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { notifyFavourites, resetFavouriteNotices, type NotifyState } from './actions'

export function NotifyButton({
  bookId,
  waiting,
  available,
}: {
  bookId: string
  waiting: number
  available: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<NotifyState | null>(null)

  const canNotify = waiting > 0 && available > 0

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          className="btn-primary text-xs disabled:opacity-40"
          disabled={pending || !canNotify}
          title={
            waiting === 0
              ? 'ทุกคนได้รับแจ้งไปแล้ว'
              : available === 0
                ? 'ยังไม่มีของ — รับสินค้าเข้าก่อน'
                : undefined
          }
          onClick={() =>
            start(async () => {
              const res = await notifyFavourites(bookId)
              setMsg(res)
              if (res.ok) router.refresh()
            })
          }
        >
          {pending ? 'กำลังส่ง...' : `แจ้ง ${waiting} คน`}
        </button>

        {waiting === 0 && (
          <button
            className="btn-ghost text-xs"
            disabled={pending}
            title="ให้แจ้งเตือนคนเดิมได้อีกครั้งเมื่อของหมดแล้วเข้าใหม่"
            onClick={() =>
              start(async () => {
                const res = await resetFavouriteNotices(bookId)
                setMsg(res)
                if (res.ok) router.refresh()
              })
            }
          >
            เปิดให้แจ้งใหม่
          </button>
        )}
      </div>
      {msg?.message && (
        <p className="text-xs" style={{ color: msg.ok ? 'var(--ok)' : 'var(--danger)' }}>{msg.message}</p>
      )}
    </div>
  )
}
