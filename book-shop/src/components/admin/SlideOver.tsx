'use client'

import { useEffect } from 'react'

export function SlideOver({
  open,
  onClose,
  title,
  children,
  widthClassName = 'sm:w-[480px]',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** ความกว้างตอนจอ >= 640px — ฟอร์มที่มีหลายคอลัมน์ย่อยต้องการที่มากกว่าค่าเริ่มต้น */
  widthClassName?: string
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-[color:var(--paper-raised)] shadow-xl ${widthClassName}`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--line)' }}>
          <h2 className="font-medium">{title}</h2>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="flex items-center justify-center rounded-lg"
            style={{ minHeight: 40, minWidth: 40 }}
          >
            <span aria-hidden className="text-lg leading-none">✕</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
