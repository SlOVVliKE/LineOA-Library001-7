import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ExportButtons } from './ExportButtons'
import { defaultDateRange } from '@/lib/csv'
import { formatBaht, formatNumber, formatDate } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requirePermission('cost.read')

  const sp = await searchParams
  const fallback = defaultDateRange(30)
  const from = sp.from ?? fallback.from
  const to = sp.to ?? fallback.to

  const supabase = await createClient()

  const [{ data: daily }, { data: perf }, { data: gap }, { data: dead }] = await Promise.all([
    supabase
      .from('v_daily_sales')
      .select('*')
      .gte('sale_date', from)
      .lte('sale_date', to)
      .order('sale_date', { ascending: false }),
    supabase.from('v_book_performance').select('*').order('gross_profit', { ascending: false }).limit(15),
    supabase.from('v_shipping_gap').select('*').order('month', { ascending: false }).limit(6),
    supabase.from('v_dead_stock').select('*').order('days_idle', { ascending: false }).limit(20),
  ])

  const revenue = (daily ?? []).reduce((s, r) => s + Number(r.revenue ?? 0), 0)
  const cogs = (daily ?? []).reduce((s, r) => s + Number(r.cogs ?? 0), 0)
  const profit = (daily ?? []).reduce((s, r) => s + Number(r.gross_profit ?? 0), 0)
  const orders = (daily ?? []).reduce((s, r) => s + Number(r.order_count ?? 0), 0)
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0

  // หาวันที่ยอดพุ่งและยอดตกในช่วงที่เลือก
  const sorted = [...(daily ?? [])].sort(
    (a, b) => Number(b.revenue ?? 0) - Number(a.revenue ?? 0)
  )
  const best = sorted[0]
  const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">รายงานกำไร</h1>

      <DateRangeFilter from={from} to={to}>
        <ExportButtons from={from} to={to} />
      </DateRangeFilter>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="จำนวนออเดอร์" value={formatNumber(orders)} />
        <Stat label="ยอดขาย" value={formatBaht(revenue)} />
        <Stat label="ต้นทุนสินค้า (COGS)" value={formatBaht(cogs)} />
        <Stat label="กำไรขั้นต้น" value={formatBaht(profit)} />
        <Stat label="อัตรากำไร" value={`${margin.toFixed(1)}%`} />
      </div>

      {best && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card border-teal-200 bg-teal-50/50">
            <div className="text-xs text-teal-800">วันที่ยอดพุ่งที่สุด</div>
            <div className="mt-1 text-lg font-semibold text-teal-900">
              {formatDate(best.sale_date as string)} · {formatBaht(Number(best.revenue))}
            </div>
          </div>
          {worst && worst !== best && (
            <div className="card">
              <div className="text-xs text-neutral-500">วันที่ยอดต่ำที่สุด (ในวันที่มีการขาย)</div>
              <div className="mt-1 text-lg font-semibold">
                {formatDate(worst.sale_date as string)} · {formatBaht(Number(worst.revenue))}
              </div>
            </div>
          )}
        </div>
      )}

      <section className="card p-0">
        <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">
          ยอดขายรายวัน แยกช่องทาง
        </h2>
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              <th className="th">วันที่</th><th className="th">ช่องทาง</th>
              <th className="th text-right">ออเดอร์</th><th className="th text-right">ยอดขาย</th>
              <th className="th text-right">ต้นทุน</th><th className="th text-right">กำไร</th>
            </tr>
          </thead>
          <tbody>
            {(daily ?? []).map((d, i) => (
              <tr key={i} className="border-t border-neutral-100">
                <td className="td">{formatDate(d.sale_date as string)}</td>
                <td className="td">{d.channel_code}</td>
                <td className="td text-right">{formatNumber(Number(d.order_count))}</td>
                <td className="td text-right">{formatBaht(Number(d.revenue))}</td>
                <td className="td text-right text-neutral-500">{formatBaht(Number(d.cogs ?? 0))}</td>
                <td className="td text-right font-medium text-teal-800">
                  {formatBaht(Number(d.gross_profit ?? 0))}
                </td>
              </tr>
            ))}
            {!daily?.length && (
              <tr><td className="td py-6 text-center text-neutral-500" colSpan={6}>
                ไม่มีการขายในช่วงวันที่เลือก
              </td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card p-0">
        <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">
          กำไรรายเล่ม (15 อันดับแรก · นับตลอดอายุการขาย)
        </h2>
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              <th className="th">SKU</th><th className="th">ชื่อหนังสือ</th>
              <th className="th text-right">ขายได้</th><th className="th text-right">รายได้</th>
              <th className="th text-right">ต้นทุน</th><th className="th text-right">กำไร</th>
            </tr>
          </thead>
          <tbody>
            {(perf ?? []).filter((p) => Number(p.qty_sold) > 0).map((p) => (
              <tr key={p.book_id as string} className="border-t border-neutral-100">
                <td className="td font-mono text-xs">{p.sku}</td>
                <td className="td">{p.title}</td>
                <td className="td text-right">{formatNumber(Number(p.qty_sold))}</td>
                <td className="td text-right">{formatBaht(Number(p.revenue))}</td>
                <td className="td text-right text-neutral-500">{formatBaht(Number(p.cogs))}</td>
                <td className="td text-right font-medium text-teal-800">
                  {formatBaht(Number(p.gross_profit))}
                </td>
              </tr>
            ))}
            {!perf?.some((p) => Number(p.qty_sold) > 0) && (
              <tr><td className="td py-6 text-center text-neutral-500" colSpan={6}>
                ยังไม่มีหนังสือเล่มไหนขายได้
              </td></tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-medium">ส่วนต่างค่าส่ง</h2>
          <p className="mb-3 text-xs text-neutral-500">
            เก็บลูกค้า 40 บาท (ฟรีเมื่อครบ 500) เทียบกับค่าส่งจริงที่จ่ายขนส่ง
            ถ้าติดลบสะสม แปลว่ากติกาค่าส่งกำลังกินกำไร
          </p>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">เดือน</th><th className="th text-right">เก็บได้</th>
                <th className="th text-right">จ่ายจริง</th><th className="th text-right">ส่วนต่าง</th>
              </tr>
            </thead>
            <tbody>
              {(gap ?? []).map((g, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="td">{formatDate(g.month as string)}</td>
                  <td className="td text-right">{formatBaht(Number(g.collected))}</td>
                  <td className="td text-right">{formatBaht(Number(g.paid_out))}</td>
                  <td className={`td text-right font-medium ${
                    Number(g.gap) < 0 ? 'text-red-600' : 'text-teal-700'}`}>
                    {formatBaht(Number(g.gap))}
                  </td>
                </tr>
              ))}
              {!gap?.length && (
                <tr><td className="td py-4 text-center text-neutral-500" colSpan={4}>ยังไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="mb-3 font-medium">ค้างสต็อกเกิน 90 วัน</h2>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">ชื่อหนังสือ</th><th className="th text-right">คงเหลือ</th>
                <th className="th text-right">ค้างมา</th><th className="th text-right">มูลค่าทุน</th>
              </tr>
            </thead>
            <tbody>
              {(dead ?? []).map((d) => (
                <tr key={d.book_id as string} className="border-t border-neutral-100">
                  <td className="td">{d.title}</td>
                  <td className="td text-right">{formatNumber(Number(d.on_hand))}</td>
                  <td className="td text-right text-amber-700">
                    {formatNumber(Number(d.days_idle))} วัน
                  </td>
                  <td className="td text-right">{formatBaht(Number(d.stock_value_at_cost))}</td>
                </tr>
              ))}
              {!dead?.length && (
                <tr><td className="td py-4 text-center text-neutral-500" colSpan={4}>
                  ไม่มีสินค้าค้างสต็อก
                </td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}
