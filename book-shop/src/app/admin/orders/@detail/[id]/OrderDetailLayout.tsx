'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'admin-order-sidebar-collapsed'

/**
 * โครงสองคอลัมน์ของหน้ารายละเอียดออเดอร์ — ฝั่งขวา (สรุปยอด/ปุ่มดำเนินการ/สลิป)
 * ยุบ/กางได้ สัดส่วน 1:1 (เดิม 3:2 แล้ว 2:1 แคบไปเรื่อยๆ ผู้ใช้ขอให้เท่ากับคอลัมน์เนื้อหา)
 * และจำกัดความกว้างรวมไว้ไม่ให้ยืดเกิน `max-w-6xl`
 * บนจอกว้างมากๆ ไม่งั้นทั้งสองคอลัมน์จะถ่างจนดูไม่สมดุลกับรายการออเดอร์ทางซ้ายที่กว้างคงที่
 *
 * จำสถานะยุบ/กางไว้ใน localStorage เพราะเป็นความชอบส่วนตัวเวลาไล่ดูทีละออเดอร์
 * ไม่ใช่ข้อมูลของออเดอร์ จึงไม่ผูกกับ id ใดโดยเฉพาะ
 */
export function OrderDetailLayout({
  content,
  sidebar,
}: {
  content: React.ReactNode
  sidebar: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      // เบราว์เซอร์บล็อก localStorage (โหมดส่วนตัว) — ใช้ค่าเริ่มต้นกางไว้
    }
  }, [])

  function toggle() {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // เก็บค่าไม่ได้ก็ไม่เป็นไร แค่ไม่จำข้ามหน้า
      }
      return next
    })
  }

  return (
    <div
      className={`grid gap-4 lg:max-w-6xl lg:items-start ${
        collapsed ? 'lg:grid-cols-[1fr_auto]' : 'lg:grid-cols-2'
      }`}
    >
      <div className="min-w-0">{content}</div>

      <div className="min-w-0 lg:sticky lg:top-6">
        <button
          onClick={toggle}
          aria-label={collapsed ? 'กางแผนสรุป/ปุ่มดำเนินการ' : 'ยุบแผนสรุป/ปุ่มดำเนินการ'}
          aria-expanded={!collapsed}
          className="mb-2 hidden items-center justify-center rounded-lg border transition lg:flex"
          style={{
            borderColor: 'var(--line-strong)',
            background: 'var(--paper-raised)',
            color: 'var(--ink)',
            height: 36,
            width: 36,
            minHeight: 36,
          }}
        >
          <span aria-hidden className="text-sm leading-none">{collapsed ? '‹' : '›'}</span>
        </button>
        {/* ยุบเฉพาะจอ >= lg เท่านั้น — ต่ำกว่านั้นเรียงเป็นแถวเดียวอยู่แล้วไม่มีปุ่มยุบให้กด
            (ปุ่มซ่อนด้วย `hidden lg:flex`) ถ้าซ่อนด้วย JS ตรงๆ คนที่เคยกดยุบไว้ตอนจอกว้าง
            แล้วมาเปิดออเดอร์เดียวกันบนมือถือจะไม่เห็น "ปุ่มดำเนินการ" เลยและกดกางกลับไม่ได้ */}
        <div className={collapsed ? 'lg:hidden' : ''}>{sidebar}</div>
      </div>
    </div>
  )
}
