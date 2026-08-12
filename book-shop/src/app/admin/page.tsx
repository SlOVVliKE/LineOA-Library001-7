import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, can } from '@/lib/auth/permissions'
import { formatBaht, formatNumber } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const user = await getCurrentUser()
  const supabase = await createClient()
  const showCost = can(user, 'cost.read')
  // RLS ปิดตาราง purchase_lots สำหรับคนที่ไม่มีสิทธิ์ ตัวเลขสต็อกจึงออกมาเป็น 0
  // ถ้าแสดงไปตรงๆ คนแพ็กของจะเข้าใจผิดว่าของหมด จึงซ่อนทั้งบล็อกไปเลย
  const showStock = showCost || can(user, 'lot.write')

  const [{ count: bookCount }, { data: stock }, { data: reorder }, { data: dead }] =
    await Promise.all([
      supabase.from('books').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('v_stock_summary').select('on_hand, stock_value_at_cost'),
      supabase.from('v_reorder_alerts').select('sku, title, on_hand, reorder_point').limit(8),
      supabase.from('v_dead_stock').select('sku, title, on_hand').limit(5),
    ])

  const totalUnits = (stock ?? []).reduce((s, r) => s + Number(r.on_hand ?? 0), 0)
  const stockValue = (stock ?? []).reduce((s, r) => s + Number(r.stock_value_at_cost ?? 0), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">ภาพรวม</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="หนังสือที่เปิดขาย" value={formatNumber(bookCount ?? 0) + ' รายการ'} />
        {showStock && (
          <Stat label="จำนวนเล่มในสต็อก" value={formatNumber(totalUnits) + ' เล่ม'} />
        )}
        {showCost && <Stat label="มูลค่าสต็อกตามราคาทุน" value={formatBaht(stockValue)} />}
      </div>

      {!showStock && (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          บัญชีของคุณดูข้อมูลสต็อกและต้นทุนไม่ได้ — ถ้าต้องใช้ ให้เจ้าของร้านเพิ่มสิทธิ์ให้
        </p>
      )}

      {showStock && (
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">ต้องสั่งเพิ่ม</h2>
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
          <h2 className="mb-3 font-medium">ค้างสต็อกเกิน 90 วัน</h2>
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
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}
