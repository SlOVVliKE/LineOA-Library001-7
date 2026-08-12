'use client'

import { useTransition } from 'react'
import { signOut } from '@/lib/auth/actions'

export function SignOutButton({
  redirectTo = '/login',
  clearDevCustomer = false,
  className = '',
  label = 'ออกจากระบบ',
}: {
  redirectTo?: string
  /** หน้าร้านสร้างรหัสลูกค้าทดสอบเก็บไว้ในเครื่อง ถ้าไม่ล้างด้วยจะเข้าเป็นคนเดิมทันที */
  clearDevCustomer?: boolean
  className?: string
  label?: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      className={
        className ||
        'rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50'
      }
      onClick={() =>
        startTransition(async () => {
          if (clearDevCustomer) {
            try {
              window.localStorage.removeItem('bs_dev_line_id')
            } catch {
              // เบราว์เซอร์บางตัวปิด localStorage ไว้ ไม่ใช่เรื่องคอขาดบาดตาย
            }
          }
          await signOut(redirectTo)
        })
      }
    >
      {pending ? 'กำลังออก...' : label}
    </button>
  )
}
