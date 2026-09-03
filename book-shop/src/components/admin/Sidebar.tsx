'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SignOutButton } from '@/components/SignOutButton'

export interface NavItem {
  href: string
  label: string
  count?: number
}

export interface NavGroup {
  title?: string
  items: NavItem[]
}

const COLLAPSE_KEY = 'admin-sidebar-collapsed'

export function Sidebar({
  groups,
  user,
}: {
  groups: NavGroup[]
  user: { name: string; roles: string[] }
}) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  // อ่านค่าที่จำไว้ตอน mount แล้วดันความกว้างจริงไปให้ <main> ผ่าน CSS variable
  // ต้องทำที่นี่เพราะ <main> อยู่คนละ component (admin/layout.tsx ฝั่ง server)
  // เมนูข้างกับเนื้อหาจึงเป็นอิสระต่อกันจริงๆ ไม่ใช่ layout เดียวกันที่ยึดกันด้วย flex
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {
      // เบราว์เซอร์บล็อก localStorage (โหมดส่วนตัว) — ใช้ค่าเริ่มต้นกางไว้
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--admin-sidebar-w', collapsed ? '0px' : '220px')
  }, [collapsed])

  function toggle() {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // เก็บค่าไม่ได้ก็ไม่เป็นไร แค่ไม่จำข้ามหน้า
      }
      return next
    })
  }

  const nav = (
    <nav className="flex h-full w-[220px] flex-col border-r" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-center justify-between border-b px-4 py-4" style={{ borderColor: 'var(--line)' }}>
        <span className="text-sm font-semibold">ระบบร้านหนังสือ</span>
        <button
          onClick={toggle}
          aria-label="ยุบเมนู"
          className="hidden items-center justify-center rounded-lg lg:flex"
          style={{ minHeight: 28, minWidth: 28, color: 'var(--ink-muted)' }}
        >
          <span aria-hidden className="text-sm leading-none">«</span>
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {groups.map((g, i) => (
          <div key={g.title ?? `top-${i}`}>
            {g.title && (
              <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                {g.title}
              </div>
            )}
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[14px] transition"
                    style={{
                      background: active ? 'var(--paper-sunken)' : 'transparent',
                      color: active ? 'var(--ink)' : 'var(--ink-muted)',
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    <span>{item.label}</span>
                    {!!item.count && <span className="badge badge-warn">{item.count}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3" style={{ borderColor: 'var(--line)' }}>
        <div className="text-xs">
          <div className="font-medium" style={{ color: 'var(--ink)' }}>{user.name}</div>
          <div style={{ color: 'var(--ink-faint)' }}>{user.roles.join(', ')}</div>
        </div>
        <div className="mt-2">
          <SignOutButton />
        </div>
      </div>
    </nav>
  )

  return (
    <>
      {/* จอ >= 1024px: เมนูข้างลอยอยู่กับที่ (fixed) แยกอิสระจากเนื้อหา — เนื้อหาเลื่อน
          ไปเท่าไหร่เมนูก็ไม่ขยับ ไม่ใช่ flex sibling ที่เลื่อนไปด้วยกันเหมือนเดิม
          <main> เว้นที่ให้ด้วย padding-left ที่อ่านค่าความกว้างจริงจาก CSS variable
          ด้านบน ยุบแล้วจะเป็น 0 เนื้อหาจึงขยายเต็มจอทันที */}
      <div className={collapsed ? 'hidden' : 'hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block'}>
        {nav}
      </div>

      {/* แถบยุบไว้มุมซ้ายบน กดกางกลับ — ต้องลอยแยกไว้เพราะเมนูจริงถูกซ่อนไปหมดแล้ว */}
      {collapsed && (
        <button
          onClick={toggle}
          aria-label="กางเมนู"
          className="hidden items-center justify-center rounded-r-lg border border-l-0 lg:fixed lg:left-0 lg:top-4 lg:z-30 lg:flex"
          style={{
            borderColor: 'var(--line)',
            background: 'var(--paper-raised)',
            color: 'var(--ink-muted)',
            minHeight: 32,
            minWidth: 24,
          }}
        >
          <span aria-hidden className="text-sm leading-none">»</span>
        </button>
      )}

      {/* จอ < 1024px: แถบบนมีปุ่มเปิดเมนู + ยุบเป็นแผงเลื่อนทับเนื้อหา (ไม่เกี่ยวกับ
          การยุบ/กางด้านบน ซึ่งมีผลเฉพาะจอ >= 1024px) */}
      <div
        className="flex items-center justify-between border-b bg-white px-3 py-2.5 lg:hidden"
        style={{ borderColor: 'var(--line)' }}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          className="flex items-center justify-center rounded-lg"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <span aria-hidden className="text-xl leading-none">☰</span>
        </button>
        <span className="text-sm font-semibold">ระบบร้านหนังสือ</span>
        <span style={{ width: 44 }} />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 bg-[color:var(--paper-raised)] shadow-xl">
            {nav}
          </div>
        </div>
      )}
    </>
  )
}
