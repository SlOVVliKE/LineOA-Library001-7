'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    setLoading(false)
    setSent(true)
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
        <div className="card w-full space-y-3">
          <h1 className="t-heading">ส่งลิงก์แล้ว</h1>
          <p className="t-body">
            ถ้ามีบัญชีที่ใช้อีเมลนี้อยู่ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว
            เปิดอีเมลแล้วกดลิงก์ในนั้นได้เลย
          </p>
          <p className="t-meta">
            ลิงก์ใช้ได้ครั้งเดียวและมีอายุจำกัด ถ้าไม่เจอในกล่องจดหมาย
            ลองดูในโฟลเดอร์สแปม
          </p>
          <Link href="/login" className="btn-ghost inline-flex">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
      <form onSubmit={onSubmit} className="card w-full space-y-4">
        <div>
          <h1 className="t-heading">ลืมรหัสผ่าน</h1>
          <p className="t-meta mt-1">
            กรอกอีเมลที่ใช้เข้าหลังบ้าน แล้วเราจะส่งลิงก์ตั้งรหัสใหม่ไปให้
          </p>
        </div>

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

        {/*
          ไม่บอกว่าอีเมลนี้มีบัญชีอยู่หรือไม่ ตั้งใจให้ขึ้นข้อความเดียวกันเสมอ
          ถ้าบอกต่างกัน หน้านี้จะกลายเป็นเครื่องมือให้คนไล่เดาว่าอีเมลไหน
          เป็นแอดมินของร้าน ซึ่งเป็นข้อมูลที่ไม่ควรแจกฟรี
        */}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสใหม่'}
        </button>

        <Link href="/login" className="t-meta block text-center underline underline-offset-2">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </form>
    </main>
  )
}
