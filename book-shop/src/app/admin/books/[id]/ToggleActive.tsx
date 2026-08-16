'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleBookActive } from '../actions'

/**
 * เปิด/ปิดการขายหนังสือ
 *
 * ปิดแล้วหนังสือจะหายจากหน้าร้านทันที แต่ยังอยู่ในสต็อกและรายงานเหมือนเดิม
 * ใช้แทนการลบ เพราะออเดอร์เก่าอ้างถึงเล่มนี้อยู่ ลบแล้วประวัติจะขาด
 */
export function ToggleActive({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="text-right">
      <button
        className="btn-ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await toggleBookActive(id, !isActive)
            setError(res.ok ? null : (res.message ?? 'ทำรายการไม่สำเร็จ'))
            if (res.ok) router.refresh()
          })
        }
      >
        {pending ? 'กำลังทำงาน...' : isActive ? 'ปิดการขาย' : 'เปิดขายอีกครั้ง'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
