'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
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

export function Sidebar({
  groups,
  user,
}: {
  groups: NavGroup[]
  user: { name: string; roles: string[] }
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const nav = (
    <nav className="flex h-full w-[220px] flex-col border-r" style={{ borderColor: 'var(--line)' }}>
      <div className="border-b px-4 py-4" style={{ borderColor: 'var(--line)' }}>
        <span className="text-sm font-semibold">ระบบร้านหนังสือ</span>
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
      {/* จอ >= 1024px: เมนูข้างค้างไว้ตลอด */}
      <div className="hidden lg:block">{nav}</div>

      {/* จอ < 1024px: แถบบนมีปุ่มเปิดเมนู + ยุบเป็นแผงเลื่อนทับเนื้อหา */}
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
