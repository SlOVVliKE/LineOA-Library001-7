'use client'

import { useState } from 'react'
import { SlideOver } from '@/components/admin/SlideOver'
import { ReceiveForm } from './receive/ReceiveForm'
import { AdjustForm } from './adjust/AdjustForm'

interface BookOption { id: string; sku: string; title: string }
interface StockRow { book_id: string; sku: string; title: string; on_hand: number }

/**
 * ปุ่ม "รับสินค้าเข้า"/"ปรับสต็อก" มุมขวาบน + แผงเลื่อนที่เปิดฟอร์มเดิม
 * (`ReceiveForm`/`AdjustForm` เดิมจากหน้า `/admin/stock/receive` และ
 * `/admin/stock/adjust` — ยังใช้ server action เดิม ยังคง route เดิมไว้เผื่อมีลิงก์เก่า)
 */
export function StockPanels({
  books,
  adjustBooks,
}: {
  books: BookOption[]
  adjustBooks: StockRow[]
}) {
  const [panel, setPanel] = useState<'receive' | 'adjust' | null>(null)

  return (
    <>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => setPanel('receive')}>รับสินค้าเข้า</button>
        <button className="btn-ghost" onClick={() => setPanel('adjust')}>ปรับสต็อก</button>
      </div>

      <SlideOver open={panel === 'receive'} onClose={() => setPanel(null)} title="รับสินค้าเข้าสต็อก">
        <p className="mb-4 text-sm text-neutral-600">
          ทุกครั้งที่รับของเข้าให้บันทึกเป็น &ldquo;ล็อต&rdquo; พร้อมต้นทุนจริง
          ระบบจะตัดสต็อกแบบ FIFO ตามลำดับที่รับเข้า และคำนวณกำไรจากต้นทุนของล็อตที่ถูกตัดจริง
        </p>
        <ReceiveForm books={books} />
      </SlideOver>

      <SlideOver open={panel === 'adjust'} onClose={() => setPanel(null)} title="ปรับสต็อก">
        <p className="mb-4 text-sm text-neutral-600">
          ใช้เมื่อตรวจนับแล้วไม่ตรง มีของเสีย หรือของหาย
          ทุกครั้งต้องระบุเหตุผล ระบบจะบันทึกไว้ในประวัติพร้อมชื่อผู้ทำรายการ
        </p>
        <AdjustForm books={adjustBooks} />
      </SlideOver>
    </>
  )
}
