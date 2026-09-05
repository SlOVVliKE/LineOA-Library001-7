'use client'

import { usePathname } from 'next/navigation'

/**
 * โครงซ้าย-ขวาของหน้าคำสั่งซื้อ (รอบ 2.1)
 *
 * ที่ 1280px ขึ้นไป: โชว์ทั้งสองฝั่งพร้อมกัน (รายการไม่หายตอนสลับออเดอร์ เพราะ
 * @list เป็นสล็อตคู่ขนานที่ไม่ต้อง mount ใหม่ตาม Next.js parallel routes)
 * คอลัมน์รายการ (ซ้าย) แคบกว่าคอลัมน์เนื้อหา/แผงขวาของฝั่งรายละเอียดโดยตั้งใจ — เป็นแค่
 * รายการให้เลือก ไม่ต้องกว้างเท่าเนื้อหาจริง (ผู้ใช้ขอให้เป็นคอลัมน์ที่เล็กที่สุดในสามคอลัมน์)
 *
 * ต่ำกว่า 1280px: กลับไปเป็นสองหน้าเหมือนเดิม — โชว์แค่รายการตอนอยู่ที่
 * /admin/orders เฉยๆ หรือโชว์แค่รายละเอียดตอนมี /[id] ต่อท้าย
 * ต้องอ่าน pathname ฝั่ง client เพราะ layout.tsx (server) ไม่รู้ query/path
 * ของ request จริงเวลามีสล็อตคู่ขนานมากกว่าหนึ่งอัน
 */
export function OrdersSplitView({
  list,
  detail,
}: {
  list: React.ReactNode
  detail: React.ReactNode
}) {
  const pathname = usePathname()
  const hasSelection = pathname !== '/admin/orders'

  return (
    <div className="xl:flex xl:items-start xl:gap-4">
      <div className={`${hasSelection ? 'hidden xl:block' : 'block'} xl:w-[300px] xl:shrink-0`}>
        {list}
      </div>
      <div className={`${hasSelection ? 'block' : 'hidden xl:block'} min-w-0 flex-1`}>
        {detail}
      </div>
    </div>
  )
}
