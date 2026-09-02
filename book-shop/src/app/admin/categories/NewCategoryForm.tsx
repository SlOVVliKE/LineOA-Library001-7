'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createCategory, type CategoryState } from './actions'

const initial: CategoryState = { ok: false }

export function NewCategoryForm({ nextSortOrder }: { nextSortOrder: number }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(createCategory, initial)

  // เพิ่มสำเร็จแล้วล้างฟอร์มให้พิมพ์ต่อได้เลย — ตอนตั้งร้านใหม่มักเพิ่มติดกันหลายหมวด
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset()
      router.refresh()
    }
  }, [state, router])

  return (
    <form ref={formRef} action={formAction} className="card space-y-3">
      <div className="font-medium">เพิ่มหมวดหมู่</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-neutral-600">ลำดับ</span>
          <input
            name="sort_order"
            type="number"
            defaultValue={nextSortOrder}
            className="input w-20"
          />
        </label>
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-neutral-600">ชื่อหมวดหมู่</span>
          <input name="name" placeholder="เช่น วรรณกรรม" className="input" required />
        </label>
        <button className="btn-primary" disabled={pending}>
          {pending ? 'กำลังเพิ่ม...' : 'เพิ่ม'}
        </button>
      </div>
      {state.message && (
        <p className="text-sm" style={{ color: state.ok ? 'var(--ok)' : 'var(--danger)' }}>{state.message}</p>
      )}
      <p className="text-xs text-neutral-500">
        ลำดับใช้เรียงปุ่มหมวดที่หน้าร้าน เลขน้อยมาก่อน
      </p>
    </form>
  )
}
