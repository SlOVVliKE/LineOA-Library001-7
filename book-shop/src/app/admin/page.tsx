import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, can } from '@/lib/auth/permissions'
import { getAdminWorkQueue } from '@/lib/admin/workQueue'
import { formatBaht, formatNumber } from '@/lib/money'
import { StatCard } from '@/components/admin/StatCard'

export const dynamic = 'force-dynamic'

interface TaskRow {
  level: 'red' | 'yellow'
  label: string
  count: number
  href: string
}

export default async function AdminDashboard() {
  const user = await getCurrentUser()
  const supabase = await createClient()
  const showCost = can(user, 'cost.read')
  const showTasks = can(user, 'order.read')
  // RLS ปิดตาราง purchase_lots สำหรับคนที่ไม่มีสิทธิ์ ตัวเลขสต็อกจึงออกมาเป็น 0
  // ถ้าแสดงไปตรงๆ คนแพ็กของจะเข้าใจผิดว่าของหมด จึงซ่อนทั้งบล็อกไปเลย
  const showStock = showCost || can(user, 'lot.write')

  const [queue, { count: bookCount }, { data: stock }, { data: reorder }, { data: dead }] =
    await Promise.all([
      getAdminWorkQueue(),
      supabase.from('books').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('v_stock_summary').select('on_hand, stock_value_at_cost'),
      supabase.from('v_reorder_alerts').select('sku, title, on_hand, reorder_point').limit(8),
      supabase.from('v_dead_stock').select('sku, title, on_hand').limit(5),
    ])

  const totalUnits = (stock ?? []).reduce((s, r) => s + Number(r.on_hand ?? 0), 0)
  const stockValue = (stock ?? []).reduce((s, r) => s + Number(r.stock_value_at_cost ?? 0), 0)

  // เรียงตามความเร่งด่วนจริง ไม่ใช่ตามหมวดข้อมูล — ของที่ต้องลงมือทำอยู่บนสุด
  const tasks: TaskRow[] = [
    { level: 'red' as const, label: 'สลิปรอตรวจ', count: queue.slipsPending, href: '/admin/orders?status=pending_payment' },
    { level: 'red' as const, label: 'แจ้งเตือนส่งไม่สำเร็จ', count: queue.notificationsFailed, href: '/admin/notifications' },
    { level: 'yellow' as const, label: 'ชำระแล้ว รอส่ง', count: queue.ordersToShip, href: '/admin/orders?status=to_ship' },
    { level: 'yellow' as const, label: 'สั่งจองรอของเข้า', count: queue.preordersWaiting, href: '/admin/preorders' },
    { level: 'yellow' as const, label: 'รอชำระส่วนที่เหลือ', count: queue.ordersAwaitingBalance, href: '/admin/orders?status=awaiting_balance' },
  ].filter((t) => t.count > 0)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">งานวันนี้</h1>

      {showTasks && (
        <section className="a-card">
          {tasks.length > 0 ? (
            <ul className="divide-y" style={{ borderColor: 'var(--line)' }}>
              {tasks.map((t) => (
                <li key={t.label} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden>{t.level === 'red' ? '🔴' : '🟡'}</span>
                    <span className="text-[14px]" style={{ color: 'var(--ink)' }}>{t.label}</span>
                    <span className={`badge ${t.level === 'red' ? 'badge-warn' : 'badge-info'}`}>
                      {t.count}
                    </span>
                  </div>
                  <Link href={t.href} className="text-sm text-teal-700 hover:underline">
                    ดู →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-[15px] font-medium" style={{ color: 'var(--ok)' }}>
              วันนี้เคลียร์แล้ว ✓
            </p>
          )}
        </section>
      )}

      {/* สภาพคลัง — ข้อมูลไว้ดู ไม่ใช่งานที่ต้องทำ จึงอยู่ล่างสุด */}
      {showStock && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-neutral-500">สภาพคลัง</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="หนังสือที่เปิดขาย" value={formatNumber(bookCount ?? 0) + ' รายการ'} />
            <StatCard label="จำนวนเล่มในสต็อก" value={formatNumber(totalUnits) + ' เล่ม'} />
            {showCost && <StatCard label="มูลค่าสต็อกตามราคาทุน" value={formatBaht(stockValue)} />}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">ต้องสั่งเพิ่ม</h3>
                <Link href="/admin/stock" className="text-sm text-teal-700">ดูสต็อกทั้งหมด</Link>
              </div>
              {reorder?.length ? (
                <table className="w-full">
                  <thead><tr>
                    <th className="th">SKU</th><th className="th">ชื่อ</th>
                    <th className="th text-right">คงเหลือ</th><th className="th text-right">จุดสั่งซื้อ</th>
                  </tr></thead>
                  <tbody>
                    {reorder.map((r) => (
                      <tr key={r.sku} className="border-t border-neutral-100">
                        <td className="td font-mono text-xs">{r.sku}</td>
                        <td className="td">{r.title}</td>
                        <td className="td text-right font-medium text-amber-700">{r.on_hand}</td>
                        <td className="td text-right text-neutral-500">{r.reorder_point}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-neutral-500">ยังไม่มีรายการที่ต่ำกว่าจุดสั่งซื้อ</p>
              )}
            </section>

            <section className="card">
              <h3 className="mb-3 font-medium">ค้างสต็อกเกิน 90 วัน</h3>
              {dead?.length ? (
                <ul className="space-y-2">
                  {dead.map((d) => (
                    <li key={d.sku} className="flex justify-between text-sm">
                      <span>{d.title}</span>
                      <span className="text-neutral-500">{d.on_hand} เล่ม</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500">ไม่มีสินค้าค้างสต็อก</p>
              )}
            </section>
          </div>
        </section>
      )}

      {!showTasks && !showStock && (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          บัญชีของคุณดูข้อมูลออเดอร์และสต็อกไม่ได้ — ถ้าต้องใช้ ให้เจ้าของร้านเพิ่มสิทธิ์ให้
        </p>
      )}
    </div>
  )
}
