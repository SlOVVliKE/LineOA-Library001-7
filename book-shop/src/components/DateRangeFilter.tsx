'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'

const PRESETS = [
  { label: '7 วัน',  days: 7 },
  { label: '30 วัน', days: 30 },
  { label: '90 วัน', days: 90 },
  { label: '1 ปี',   days: 365 },
]

function fmt(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function DateRangeFilter({
  from,
  to,
  children,
}: {
  from: string
  to: string
  /** ปุ่มเสริม เช่น ดาวน์โหลด CSV */
  children?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [localFrom, setLocalFrom] = useState(from)
  const [localTo, setLocalTo] = useState(to)

  function apply(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams(params.toString())
    next.set('from', nextFrom)
    next.set('to', nextTo)
    startTransition(() => router.push(`${pathname}?${next.toString()}`))
  }

  function preset(days: number) {
    const t = new Date()
    const f = new Date(t.getTime() - days * 86_400_000)
    setLocalFrom(fmt(f))
    setLocalTo(fmt(t))
    apply(fmt(f), fmt(t))
  }

  return (
    <div className="card flex flex-wrap items-end gap-3">
      <div>
        <label className="label">ตั้งแต่วันที่</label>
        <input
          type="date"
          className="input"
          value={localFrom}
          max={localTo}
          onChange={(e) => setLocalFrom(e.target.value)}
        />
      </div>
      <div>
        <label className="label">ถึงวันที่</label>
        <input
          type="date"
          className="input"
          value={localTo}
          min={localFrom}
          onChange={(e) => setLocalTo(e.target.value)}
        />
      </div>

      <button
        className="btn-primary"
        disabled={pending}
        onClick={() => apply(localFrom, localTo)}
      >
        {pending ? 'กำลังโหลด...' : 'ดูข้อมูล'}
      </button>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            className="badge border border-neutral-300 text-neutral-600 hover:border-teal-500 hover:text-teal-700"
            onClick={() => preset(p.days)}
            disabled={pending}
          >
            {p.label}
          </button>
        ))}
      </div>

      {children && <div className="ml-auto">{children}</div>}
    </div>
  )
}
