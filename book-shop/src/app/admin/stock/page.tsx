import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, can } from '@/lib/auth/permissions'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { DailyBars, type DailyRow } from '@/components/DailyBars'
import { defaultDateRange } from '@/lib/csv'
import { formatBaht, formatNumber, formatDate } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!can(user, 'lot.write') && !can(user, 'cost.read')) redirect('/admin/forbidden')

  const showCost = can(user, 'cost.read')
  const sp = await searchParams
  const fallback = defaultDateRange(30)
  const from = sp.from ?? fallback.from
  const to = sp.to ?? fallback.to

  const supabase = await createClient()

  const [{ data: rows }, { data: daily }, { data: lots }] = await Promise.all([
    supabase.from('v_stock_summary').select('*').order('title'),
    supabase
      .from('v_stock_movement_daily_total')
      .select('*')
      .gte('day', from)
      .lte('day', to)
      .order('day'),
    supabase
      .from('purchase_lots')
      .select('id, lot_no, supplier, received_at, created_at, qty_received, qty_remaining, unit_cost, shipping_cost, landed_unit_cost, books(sku, title)')
      .gte('received_at', from)
      .lte('received_at', to)
      .order('received_at', { ascending: false })
      .limit(50),
  ])

  const totalValue = (rows ?? []).reduce((s, r) => s + Number(r.stock_value_at_cost ?? 0), 0)
  const totalUnits = (rows ?? []).reduce((s, r) => s + Number(r.on_hand ?? 0), 0)

  const dailyRows: DailyRow[] = (daily ?? []).map((d) => ({
    day: d.day as string,
    received: Number(d.qty_received ?? 0),
    sold: Number(d.qty_sold ?? 0),
    other: Number(d.qty_adjusted ?? 0) + Number(d.qty_damaged ?? 0),
    cogs: Number(d.cogs_out ?? 0),
  }))

  const movedDays = dailyRows.filter((d) => d.sold > 0 || d.received > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">สต็อกและต้นทุน</h1>
        <div className="flex gap-2">
          <Link href="/admin/stock/receive" className="btn-primary">รับสินค้าเข้า</Link>
          <Link href="/admin/stock/adjust" className="btn-ghost">ปรับสต็อก</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="text-xs text-neutral-500">จำนวนเล่มทั้งหมด (ณ ตอนนี้)</div>
          <div className="mt-1 text-2xl font-semibold">{formatNumber(totalUnits)}</div>
        </div>
        {showCost && (
          <div className="card">
            <div className="text-xs text-neutral-500">มูลค่าสต็อกตามราคาทุน (ณ ตอนนี้)</div>
            <div className="mt-1 text-2xl font-semibold">{formatBaht(totalValue)}</div>
          </div>
        )}
      </div>

      <DateRangeFilter from={from} to={to} />

      <section className="space-y-2">
        <h2 className="font-medium">ความเคลื่อนไหวรายวัน</h2>
        <DailyBars rows={dailyRows} />
      </section>

      {movedDays.length > 0 && (
        <section className="card overflow-x-auto p-0">
          <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">
            สรุปรายวัน (เฉพาะวันที่มีความเคลื่อนไหว)
          </h2>
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="th">วันที่</th>
                <th className="th text-right">รับเข้า</th>
                <th className="th text-right">ขายออก</th>
                <th className="th text-right">ปรับ/เสียหาย</th>
                <th className="th text-right">สุทธิ</th>
                {showCost && <th className="th text-right">ต้นทุนที่ขายไป</th>}
              </tr>
            </thead>
            <tbody>
              {[...movedDays].reverse().map((d) => (
                <tr key={d.day} className="border-t border-neutral-100">
                  <td className="td">{formatDate(d.day)}</td>
                  <td className="td text-right text-sky-700">
                    {d.received > 0 ? `+${formatNumber(d.received)}` : '—'}
                  </td>
                  <td className="td text-right font-medium text-teal-800">
                    {d.sold > 0 ? formatNumber(d.sold) : '—'}
                  </td>
                  <td className="td text-right text-neutral-500">
                    {d.other !== 0 ? formatNumber(d.other) : '—'}
                  </td>
                  <td className="td text-right">
                    {formatNumber(d.received - d.sold + d.other)}
                  </td>
                  {showCost && (
                    <td className="td text-right">{d.cogs > 0 ? formatBaht(d.cogs) : '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {showCost && (
        <section className="card overflow-x-auto p-0">
          <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">
            ล็อตที่รับเข้าในช่วงนี้
          </h2>
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="th">ล็อต</th>
                <th className="th">หนังสือ</th>
                <th className="th">วันที่ของมาถึง</th>
                <th className="th">วันที่บันทึกเข้าระบบ</th>
                <th className="th">ซัพพลายเออร์</th>
                <th className="th text-right">รับเข้า</th>
                <th className="th text-right">เหลือ</th>
                <th className="th text-right">ต้นทุนจริง/เล่ม</th>
              </tr>
            </thead>
            <tbody>
              {(lots ?? []).map((l) => {
                const book = l.books as unknown as { sku: string; title: string } | null
                const received = new Date(l.received_at as string).toDateString()
                const created = new Date(l.created_at as string).toDateString()
                return (
                  <tr key={l.id as string} className="border-t border-neutral-100">
                    <td className="td font-mono text-xs">{(l.lot_no as string) ?? '—'}</td>
                    <td className="td">{book?.title ?? '—'}</td>
                    <td className="td">{formatDate(l.received_at as string)}</td>
                    <td className="td text-neutral-500">
                      {formatDate(l.created_at as string)}
                      {received !== created && (
                        <span className="ml-1 text-xs text-amber-600">(บันทึกย้อนหลัง)</span>
                      )}
                    </td>
                    <td className="td text-neutral-600">{(l.supplier as string) ?? '—'}</td>
                    <td className="td text-right">{Number(l.qty_received)}</td>
                    <td className="td text-right font-medium">{Number(l.qty_remaining)}</td>
                    <td className="td text-right font-medium text-teal-800">
                      {formatBaht(Number(l.landed_unit_cost))}
                    </td>
                  </tr>
                )
              })}
              {!lots?.length && (
                <tr>
                  <td className="td py-6 text-center text-neutral-500" colSpan={8}>
                    ไม่มีการรับสินค้าเข้าในช่วงวันที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
            &ldquo;วันที่ของมาถึง&rdquo; คือวันที่ระบุตอนกรอกฟอร์ม ใช้จัดลำดับ FIFO ·
            &ldquo;วันที่บันทึกเข้าระบบ&rdquo; คือเวลาจริงที่กดบันทึก — ถ้าสองค่าไม่ตรงกันแปลว่าบันทึกย้อนหลัง
          </p>
        </section>
      )}

      <section className="card overflow-x-auto p-0">
        <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">สต็อกคงเหลือปัจจุบัน</h2>
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              <th className="th">SKU</th>
              <th className="th">ชื่อหนังสือ</th>
              <th className="th text-right">คงเหลือ</th>
              <th className="th text-right">จอง</th>
              <th className="th text-right">ขายได้</th>
              {showCost && <th className="th text-right">ต้นทุนเฉลี่ย</th>}
              {showCost && <th className="th text-right">มูลค่าสต็อก</th>}
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.book_id as string} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="td font-mono text-xs">{r.sku}</td>
                <td className="td">
                  <Link href={`/admin/books/${r.book_id}`} className="text-teal-700 hover:underline">
                    {r.title}
                  </Link>
                </td>
                <td className="td text-right font-medium">{formatNumber(Number(r.on_hand))}</td>
                <td className="td text-right text-neutral-500">{formatNumber(Number(r.reserved))}</td>
                <td className="td text-right">{formatNumber(Number(r.available_to_sell))}</td>
                {showCost && (
                  <td className="td text-right">
                    {r.avg_unit_cost ? formatBaht(Number(r.avg_unit_cost)) : '—'}
                  </td>
                )}
                {showCost && (
                  <td className="td text-right">{formatBaht(Number(r.stock_value_at_cost))}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
