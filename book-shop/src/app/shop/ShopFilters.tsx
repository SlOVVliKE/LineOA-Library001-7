'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export interface Category {
  id: string
  name: string
}

/**
 * ฟิลเตอร์แบบเลือกได้หลายอัน
 *
 * ใช้ URL เป็นที่เก็บสถานะ ไม่ใช่ state ในหน้า เพราะ:
 *   - ลูกค้าแชร์ลิงก์ที่กรองไว้ให้เพื่อนได้
 *   - กดย้อนกลับแล้วฟิลเตอร์เดิมยังอยู่
 *   - หน้ารายการเป็น server component อยู่แล้ว ข้อมูลจึงมาจากฐานข้อมูลตรงๆ
 *
 * เปลี่ยนจากช่องติ๊กมาเป็นปุ่มกลม (chip) ด้วยสองเหตุผล
 *   1) ช่องติ๊กเดิมกว้าง 16px ซึ่งเล็กกว่าระยะที่นิ้วแตะได้แม่นมาก
 *      คนใช้ต้องเล็งหรือกดหลายครั้ง ทั้งที่ตัวหนังสือข้างๆ ก็กดได้
 *      แต่ไม่มีอะไรบอกให้รู้
 *   2) chip ที่ถูกเลือกเห็นชัดจากระยะสายตาปกติ ไม่ต้องเพ่งหาเครื่องหมายถูก
 *      บนจอมือถือกลางแดดยิ่งต่างกันมาก
 */
export function ShopFilters({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, start] = useTransition()

  const modes = params.getAll('mode')
  const cats = params.getAll('cat')
  const sortNew = params.get('sort') === 'new'

  function apply(next: URLSearchParams) {
    const s = next.toString()
    start(() => router.push(s ? `/shop?${s}` : '/shop', { scroll: false }))
  }

  function toggleMulti(key: string, value: string, checked: boolean) {
    const next = new URLSearchParams(params.toString())
    const current = next.getAll(key).filter((v) => v !== value)
    next.delete(key)
    for (const v of current) next.append(key, v)
    if (checked) next.append(key, value)
    apply(next)
  }

  function toggleSort(checked: boolean) {
    const next = new URLSearchParams(params.toString())
    if (checked) next.set('sort', 'new')
    else next.delete('sort')
    apply(next)
  }

  const activeCount = modes.length + cats.length + (sortNew ? 1 : 0)

  return (
    <div className={`card space-y-3 transition-opacity ${pending ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="t-meta">
          ตัวกรอง{activeCount > 0 && ` · เลือกไว้ ${activeCount}`}
        </span>
        {activeCount > 0 && (
          <button
            type="button"
            className="min-h-[36px] rounded-lg px-2 text-[13px] underline underline-offset-2"
            style={{ color: 'var(--ink-muted)' }}
            onClick={() => {
              // เก็บคำค้นไว้ ล้างเฉพาะตัวกรอง — คนกดปุ่มนี้ตั้งใจล้างตัวกรอง
              // ไม่ได้ตั้งใจให้คำที่พิมพ์ไปแล้วหายไปด้วย
              const next = new URLSearchParams()
              const q = params.get('q')
              if (q) next.set('q', q)
              apply(next)
            }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip
          label="พร้อมส่ง"
          checked={modes.includes('stock')}
          onChange={(c) => toggleMulti('mode', 'stock', c)}
        />
        <Chip
          label="เปิดจอง"
          checked={modes.includes('preorder')}
          onChange={(c) => toggleMulti('mode', 'preorder', c)}
        />
        <Chip label="มาใหม่ก่อน" checked={sortNew} onChange={toggleSort} />
      </div>

      {categories.length > 0 && (
        <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
          <div className="t-micro">หมวดหมู่</div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                checked={cats.includes(c.id)}
                onChange={(checked) => toggleMulti('cat', c.id, checked)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ปุ่มกรองแบบ chip
 *
 * ใช้ <button> ที่มี aria-pressed แทน <input type="checkbox">
 * เพราะสิ่งที่เกิดขึ้นจริงคือ "กดแล้วหน้าเปลี่ยนทันที" ซึ่งเป็นพฤติกรรมของปุ่ม
 * ไม่ใช่ช่องติ๊กที่รอกดยืนยันทีหลัง โปรแกรมอ่านหน้าจอจะได้บอกตรงกับที่เกิดขึ้น
 *
 * สูง 40px — ต่ำกว่า 44px นิดหน่อยเพราะ chip เรียงหลายอันในแถวเดียว
 * ถ้าสูงเต็ม 44 ทุกอันจะกินพื้นที่จนดันรายการหนังสือตกจอ
 * ระยะห่างระหว่าง chip 8px ช่วยกันกดพลาดไปยังอันข้างๆ อยู่แล้ว
 */
function Chip({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className="min-h-[40px] rounded-full border px-3.5 text-[14px] transition active:scale-95"
      style={
        checked
          ? { background: 'var(--ink)', borderColor: 'var(--ink)', color: '#fff' }
          : {
              background: 'var(--paper-raised)',
              borderColor: 'var(--line-strong)',
              color: 'var(--ink-muted)',
            }
      }
    >
      {label}
    </button>
  )
}
