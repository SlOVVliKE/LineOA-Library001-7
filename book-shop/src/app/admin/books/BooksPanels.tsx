'use client'

import { useState } from 'react'
import { SlideOver } from '@/components/admin/SlideOver'
import { BookForm } from './BookForm'
import { createBook } from './actions'

interface Category { id: string; name: string }

/**
 * ปุ่ม "เพิ่มหนังสือ" มุมขวาบน เปิดแผงเลื่อนแทนการไปหน้าใหม่
 * `createBook` เดิม redirect กลับมา `/admin/books` เองอยู่แล้วตอนบันทึกสำเร็จ
 * (ดู actions.ts) ซึ่งพอ redirect ไปที่หน้าเดิมที่เปิดแผงอยู่ หน้าจะรีเฟรชใหม่
 * ทั้งหน้า แผงจึงปิดเองโดยไม่ต้องเขียนโค้ดปิดแผงเพิ่ม
 */
export function BooksPanels({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>เพิ่มหนังสือ</button>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="เพิ่มหนังสือ"
        widthClassName="sm:w-[640px]"
      >
        <BookForm action={createBook} categories={categories} />
      </SlideOver>
    </>
  )
}
