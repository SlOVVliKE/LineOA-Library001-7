'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCategory, deleteCategory, type CategoryState } from './actions'

const initial: CategoryState = { ok: false }

export function CategoryRow({
  id,
  name,
  slug,
  sortOrder,
  bookCount,
}: {
  id: string
  name: string
  slug: string
  sortOrder: number
  bookCount: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [state, formAction, saving] = useActionState(updateCategory, initial)
  const [deleting, startDelete] = useTransition()
  const [delMsg, setDelMsg] = useState<CategoryState | null>(null)

  if (!editing) {
    return (
      <tr className="border-t border-neutral-200">
        <td className="px-3 py-2 text-neutral-500">{sortOrder}</td>
        <td className="px-3 py-2 font-medium">{name}</td>
        <td className="px-3 py-2 text-xs text-neutral-400">{slug}</td>
        <td className="px-3 py-2 text-right">
          {bookCount > 0 ? `${bookCount} เล่ม` : <span className="text-neutral-400">—</span>}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center justify-end gap-2">
            <button className="btn-ghost text-xs" onClick={() => setEditing(true)}>
              แก้ไข
            </button>
            <button
              className="btn-ghost text-xs text-red-600 disabled:opacity-40"
              disabled={deleting || bookCount > 0}
              title={bookCount > 0 ? 'ต้องย้ายหนังสือออกจากหมวดนี้ก่อน' : undefined}
              onClick={() =>
                startDelete(async () => {
                  const res = await deleteCategory(id)
                  setDelMsg(res)
                  if (res.ok) router.refresh()
                })
              }
            >
              {deleting ? 'กำลังลบ...' : 'ลบ'}
            </button>
          </div>
          {delMsg?.message && !delMsg.ok && (
            <p className="mt-1 text-right text-xs text-red-600">{delMsg.message}</p>
          )}
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t border-neutral-200 bg-neutral-50">
      <td colSpan={5} className="px-3 py-2">
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input
            name="sort_order"
            type="number"
            defaultValue={sortOrder}
            className="input w-20"
            aria-label="ลำดับ"
          />
          <input name="name" defaultValue={name} className="input max-w-xs" aria-label="ชื่อหมวด" />
          <button className="btn-primary text-xs" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button type="button" className="btn-ghost text-xs" onClick={() => setEditing(false)}>
            ยกเลิก
          </button>
          {state.message && (
            <span className="text-xs" style={{ color: state.ok ? 'var(--ok)' : 'var(--danger)' }}>
              {state.message}
            </span>
          )}
        </form>
        <p className="mt-1 text-xs text-neutral-500">
          รหัสหมวด (slug) คือ <code>{slug}</code> — เปลี่ยนชื่อแล้วรหัสไม่เปลี่ยนตาม
          เพื่อไม่ให้ลิงก์เดิมที่ลูกค้าเซฟไว้พัง
        </p>
      </td>
    </tr>
  )
}
