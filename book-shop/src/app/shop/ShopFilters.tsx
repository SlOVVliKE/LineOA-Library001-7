'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export interface Category {
  id: string
  name: string
}

/**
 * ฟิลเตอร์แบบติ๊กเลือกได้หลายอัน
 *
 * ใช้ URL เป็นที่เก็บสถานะ ไม่ใช่ state ในหน้า เพราะ:
 *   - ลูกค้าแชร์ลิงก์ที่กรองไว้ให้เพื่อนได้
 *   - กดย้อนกลับแล้วฟิลเตอร์เดิมยังอยู่
 *   - หน้ารายการเป็น server component อยู่แล้ว ข้อมูลจึงมาจากฐานข้อมูลตรงๆ
 *
 * ติ๊กแล้วโหลดใหม่ทันที ไม่มีปุ่ม "ใช้ตัวกรอง" เพราะรายการหนังสือไม่ยาว
 * และการต้องกดยืนยันอีกครั้งทำให้คนเลิกใช้ฟิลเตอร์
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
    start(() => router.push(s ? `/shop?${s}` : '/shop'))
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

  const hasFilter = modes.length > 0 || cats.length > 0 || sortNew

  return (
    <div className={`card space-y-3 ${pending ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">ตัวกรอง</span>
        {hasFilter && (
          <button
            type="button"
            className="text-xs text-teal-700 hover:underline"
            onClick={() => {
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

      <div className="space-y-1.5">
        <div className="text-xs text-neutral-500">สถานะสินค้า</div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Check
            label="พร้อมส่ง"
            checked={modes.includes('stock')}
            onChange={(c) => toggleMulti('mode', 'stock', c)}
          />
          <Check
            label="เปิดจอง"
            checked={modes.includes('preorder')}
            onChange={(c) => toggleMulti('mode', 'preorder', c)}
          />
          <Check
            label="เรียงของเข้าใหม่ก่อน"
            checked={sortNew}
            onChange={toggleSort}
          />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="space-y-1.5 border-t border-neutral-200 pt-3">
          <div className="text-xs text-neutral-500">หมวดหมู่ (เลือกได้หลายหมวด)</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {categories.map((c) => (
              <Check
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

function Check({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-neutral-300 text-teal-700 focus:ring-teal-600"
      />
      <span className={checked ? 'text-teal-800' : 'text-neutral-700'}>{label}</span>
    </label>
  )
}
