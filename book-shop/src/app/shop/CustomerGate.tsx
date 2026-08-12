'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getLiffIdToken } from '@/lib/line/liff'

/**
 * ทำให้ลูกค้ามี session ก่อนใช้งาน
 *
 * ในแอป LINE  : ใช้ LIFF ID token
 * นอกแอป LINE : โหมดทดสอบ (เฉพาะตอนพัฒนา) — สร้างรหัสลูกค้าสุ่มเก็บไว้ในเครื่อง
 *               เพื่อให้ลองสั่งซื้อได้โดยยังไม่ต้องมี LINE channel
 */
export function CustomerGate() {
  const router = useRouter()
  const [status, setStatus] = useState<'working' | 'error'>('working')
  const [message, setMessage] = useState('กำลังเข้าสู่ระบบ...')

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const idToken = await getLiffIdToken()

        let payload: Record<string, string>
        if (idToken) {
          payload = { idToken }
        } else {
          let devId = window.localStorage.getItem('bs_dev_line_id')
          if (!devId) {
            devId = 'devU' + Math.random().toString(36).slice(2, 12)
            window.localStorage.setItem('bs_dev_line_id', devId)
          }
          payload = { devLineUserId: devId, displayName: 'ลูกค้าทดสอบ' }
        }

        const res = await fetch('/api/auth/liff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error ?? 'เข้าสู่ระบบไม่สำเร็จ')
        }
        if (!cancelled) router.refresh()
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setMessage(e instanceof Error ? e.message : 'เข้าสู่ระบบไม่สำเร็จ')
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="card text-center text-sm">
      <p className={status === 'error' ? 'text-red-600' : 'text-neutral-600'}>{message}</p>
      {status === 'error' && (
        <button className="btn-ghost mt-3" onClick={() => location.reload()}>
          ลองใหม่
        </button>
      )}
    </div>
  )
}
