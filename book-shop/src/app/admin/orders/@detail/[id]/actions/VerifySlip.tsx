'use client'

import { useState, useTransition } from 'react'
import { getSlipUrl } from '../../../actions'

/** แสดงหลักฐานการโอน — แยกจากปุ่มยืนยัน/ปฏิเสธ (VerifyActions) เพราะเป็นคนละงาน:
 * นี่แค่ดูสลิป ไม่ได้ทำอะไรกับออเดอร์ */
export function VerifySlip({ slipPath }: { slipPath: string | null }) {
  const [, startTransition] = useTransition()
  const [slipUrl, setSlipUrl] = useState<string | null>(null)

  if (!slipPath) return null

  function openSlip() {
    startTransition(async () => {
      const url = await getSlipUrl(slipPath as string)
      setSlipUrl(url)
    })
  }

  return (
    <div>
      {!slipUrl && (
        <button className="btn-ghost w-full" onClick={openSlip}>
          ดูสลิป
        </button>
      )}
      {slipUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slipUrl} alt="สลิป" className="w-full rounded-lg border border-neutral-200" />
      )}
    </div>
  )
}
