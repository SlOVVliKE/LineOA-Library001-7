'use client'

import { useFormStatus } from 'react-dom'

/**
 * ปุ่มส่งฟอร์มที่รู้สถานะของฟอร์มเอง ผ่าน useFormStatus
 *
 * รับ className ได้ เพราะบางที่ต้องการปุ่มเต็มความกว้าง (แถบล่างจอ)
 * บางที่ต้องการปุ่มพอดีเนื้อหา ของเดิมตายตัวเป็น btn-primary อย่างเดียว
 * เลยต้องไปห่อ div เพิ่มทุกครั้งที่อยากได้เต็มความกว้าง
 */
export function SubmitButton({
  children,
  className = 'btn-primary',
  pendingLabel = 'กำลังบันทึก...',
}: {
  children: React.ReactNode
  className?: string
  pendingLabel?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  )
}
