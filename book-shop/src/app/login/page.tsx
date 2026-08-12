'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
      <form onSubmit={onSubmit} className="card w-full space-y-4">
        <h1 className="text-lg font-semibold">เข้าสู่ระบบหลังบ้าน</h1>

        <div>
          <label className="label">อีเมล</label>
          <input className="input" type="email" value={email} required
            onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div>
          <label className="label">รหัสผ่าน</label>
          <input className="input" type="password" value={password} required
            onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  )
}
