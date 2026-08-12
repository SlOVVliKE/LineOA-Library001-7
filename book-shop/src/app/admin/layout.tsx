import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, can } from '@/lib/auth/permissions'
import { SignOutButton } from '@/components/SignOutButton'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const nav = [
    { href: '/admin',              label: 'ภาพรวม',        show: true },
    { href: '/admin/orders',       label: 'คำสั่งซื้อ',     show: can(user, 'order.read') },
    { href: '/admin/preorders',    label: 'สั่งจอง',       show: can(user, 'order.read') },
    { href: '/admin/books',        label: 'หนังสือ',       show: can(user, 'book.write') },
    { href: '/admin/stock',        label: 'สต็อกและต้นทุน', show: can(user, 'lot.write') || can(user, 'cost.read') },
    { href: '/admin/stock/receive',label: 'รับสินค้าเข้า',  show: can(user, 'lot.write') },
    { href: '/admin/stock/adjust', label: 'ปรับสต็อก',     show: can(user, 'lot.write') },
    { href: '/admin/reports',      label: 'รายงานกำไร',    show: can(user, 'cost.read') },
  ].filter((n) => n.show)

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">ระบบร้านหนังสือ</span>
            <nav className="flex gap-1">
              {nav.map((n) => (
                <Link key={n.href} href={n.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-neutral-500">
              <div className="font-medium text-neutral-700">
                {user.displayName ?? user.email}
              </div>
              <div>{user.roles.join(', ')}</div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
