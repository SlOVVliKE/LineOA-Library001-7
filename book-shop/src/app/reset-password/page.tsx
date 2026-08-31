'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** สั้นกว่านี้ Supabase ก็รับ แต่ 8 ตัวคือขั้นต่ำที่ควรยอมสำหรับบัญชีที่คุมเงินร้าน */
const MIN_LENGTH = 8

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState<'checking' | 'ok' | 'no-session'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /**
   * ต้องมี session ก่อนถึงจะตั้งรหัสใหม่ได้
   *
   * session ตัวนี้เกิดจาก /auth/callback ที่แลกรหัสในลิงก์อีเมลมาให้แล้ว
   * ถ้ามีคนเปิด /reset-password ตรงๆ โดยไม่ผ่านลิงก์ จะไม่มี session
   * และต้องบอกให้ชัดว่าให้ไปเริ่มที่หน้าลืมรหัสผ่าน ไม่ใช่ปล่อยให้กรอกแล้วค่อยพัง
   */
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setReady(data.user ? 'ok' : 'no-session')
    })
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_LENGTH) {
      setError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_LENGTH} ตัวอักษร`)
      return
    }
    if (password !== confirm) {
      setError('รหัสผ่านสองช่องไม่ตรงกัน')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      // เช่น ลิงก์หมดอายุระหว่างที่ค้างหน้านี้ไว้ หรือรหัสซ้ำกับอันเดิม
      setError(error.message)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  if (ready === 'checking') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
        <p className="t-meta w-full text-center">กำลังตรวจสอบลิงก์...</p>
      </main>
    )
  }

  if (ready === 'no-session') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
        <div className="card w-full space-y-3">
          <h1 className="t-heading">ลิงก์ใช้ไม่ได้แล้ว</h1>
          <p className="t-body">
            ลิงก์ตั้งรหัสผ่านหมดอายุ ถูกใช้ไปแล้ว หรือคุณเปิดหน้านี้โดยไม่ได้มาจากลิงก์ในอีเมล
          </p>
          <Link href="/forgot-password" className="btn-primary inline-flex">
            ขอลิงก์ใหม่
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
      <form onSubmit={onSubmit} className="card w-full space-y-4">
        <div>
          <h1 className="t-heading">ตั้งรหัสผ่านใหม่</h1>
          <p className="t-meta mt-1">ตั้งเสร็จแล้วระบบจะพาเข้าหลังบ้านให้เลย</p>
        </div>

        <div>
          <label className="label" htmlFor="pw">รหัสผ่านใหม่</label>
          <input
            id="pw"
            className="input"
            type="password"
            value={password}
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="t-micro mt-1">อย่างน้อย {MIN_LENGTH} ตัวอักษร</p>
        </div>

        <div>
          <label className="label" htmlFor="pw2">พิมพ์รหัสผ่านใหม่อีกครั้ง</label>
          <input
            id="pw2"
            className="input"
            type="password"
            value={confirm}
            required
            autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && (
          <p
            className="rounded-xl px-3.5 py-2.5 text-[13px]"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
          >
            {error}
          </p>
        )}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
        </button>
      </form>
    </main>
  )
}
