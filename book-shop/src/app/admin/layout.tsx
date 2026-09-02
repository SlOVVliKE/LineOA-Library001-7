import { redirect } from 'next/navigation'
import { getCurrentUser, can } from '@/lib/auth/permissions'
import { getAdminWorkQueue } from '@/lib/admin/workQueue'
import { Sidebar, type NavGroup } from '@/components/admin/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const queue = await getAdminWorkQueue()

  // ตัวเลขข้าง "คำสั่งซื้อ" รวมงานค้างทุกแบบที่เกี่ยวกับออเดอร์ (รอส่ง/รอชำระ
  // ส่วนที่เหลือ/รอตรวจสลิป) เพราะหน้าแรก "งานวันนี้" แยกให้เห็นทีละแถวอยู่แล้ว
  // เมนูข้างจึงพอเป็นผลรวมเดียวให้รู้ว่า "มีอะไรค้างในหมวดนี้บ้าง"
  const ordersBadge = queue.slipsPending + queue.ordersToShip + queue.ordersAwaitingBalance

  const groups: NavGroup[] = [
    { items: [{ href: '/admin', label: 'งานวันนี้' }] },
    {
      title: 'ขาย',
      items: [
        can(user, 'order.read') && { href: '/admin/orders', label: 'คำสั่งซื้อ', count: ordersBadge },
        can(user, 'order.read') && { href: '/admin/preorders', label: 'สั่งจอง', count: queue.preordersWaiting },
      ].filter(Boolean) as NavGroup['items'],
    },
    {
      title: 'สินค้า',
      items: [
        can(user, 'book.write') && { href: '/admin/books', label: 'หนังสือ' },
        can(user, 'book.write') && { href: '/admin/categories', label: 'หมวดหมู่' },
        can(user, 'book.write') && { href: '/admin/favourites', label: 'ลูกค้าสนใจ' },
      ].filter(Boolean) as NavGroup['items'],
    },
    {
      title: 'คลัง',
      items: [
        (can(user, 'lot.write') || can(user, 'cost.read')) &&
          { href: '/admin/stock', label: 'สต็อกและต้นทุน' },
      ].filter(Boolean) as NavGroup['items'],
    },
    {
      title: 'รายงาน',
      items: [
        can(user, 'cost.read') && { href: '/admin/reports', label: 'กำไร' },
      ].filter(Boolean) as NavGroup['items'],
    },
    {
      title: 'ระบบ',
      items: [
        can(user, 'order.read') &&
          { href: '/admin/notifications', label: 'แจ้งเตือน', count: queue.notificationsFailed },
      ].filter(Boolean) as NavGroup['items'],
    },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar groups={groups} user={{ name: user.displayName ?? user.email ?? '', roles: user.roles }} />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">{children}</main>
    </div>
  )
}
