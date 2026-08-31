'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * แยกส่วนที่อ่าน query string ออกมาแล้วครอบด้วย Suspense
 *
 * useSearchParams บังคับให้ต้องมี Suspense ครอบ ไม่งั้น Next จะไม่ยอม
 * prerender หน้านี้เป็นไฟล์นิ่ง แล้วหน้า login ที่ควรขึ้นทันทีจะกลายเป็น
 * หน้าที่ต้องรอเซิร์ฟเวอร์เรนเดอร์ทุกครั้ง — เสียเปล่าเพราะแค่จะอ่านค่าเดียว
 */
function LinkErrorNotice() {
  const reason = useSearchParams().get('error')
  if (reason !== 'link') return null

  return (
    <p
      className="rounded-xl px-3.5 py-2.5 text-[13px]"
      style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}
    >
      ลิงก์ในอีเมลใช้ไม่ได้แล้ว — อาจหมดอายุหรือถูกใช้ไปแล้ว
      กด &ldquo;ลืมรหัสผ่าน&rdquo; ด้านล่างเพื่อขอลิงก์ใหม่
    </p>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      // ไม่แยกว่า "ไม่มีอีเมลนี้" กับ "รหัสผิด" เพราะการแยกจะบอกคนนอก
      // ว่าอีเมลไหนเป็นบัญชีแอดมินของร้าน
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
      <form onSubmit={onSubmit} className="card w-full space-y-4">
        <h1 className="t-heading">เข้าสู่ระบบหลังบ้าน</h1>

        <Suspense fallback={null}>
          <LinkErrorNotice />
        </Suspense>

        <div>
          <label className="label" htmlFor="email">อีเมล</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            required
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="password">รหัสผ่าน</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            required
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>

        <Link
          href="/forgot-password"
          className="t-meta block text-center underline underline-offset-2"
        >
          ลืมรหัสผ่าน
        </Link>
      </form>
    </main>
  )
}
