'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fulfillQueue, type PreorderState } from './actions'

export function FulfillButton({ bookId }: { bookId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<PreorderState | null>(null)

  return (
    <div className="space-y-1">
      <button
        className="btn-ghost text-xs"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await fulfillQueue(bookId)
            setMsg(res)
            if (res.ok) router.refresh()
          })
        }
      >
        {pending ? 'กำลังจ่าย...' : 'จ่ายของตามคิว'}
      </button>
      {msg?.message && (
        <p className={`text-xs ${msg.ok ? 'text-teal-700' : 'text-red-600'}`}>{msg.message}</p>
      )}
    </div>
  )
}
