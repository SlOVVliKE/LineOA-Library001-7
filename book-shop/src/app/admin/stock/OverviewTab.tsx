import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatBaht, formatNumber } from '@/lib/money'

/** แท็บ "สต็อกคงเหลือ" — ตอบคำถาม "ตอนนี้เหลืออะไรเท่าไหร่" ค่าเริ่มต้นของหน้าคลัง */
export async function OverviewTab({ showCost }: { showCost: boolean }) {
  const supabase = await createClient()
  const { data: rows } = await supabase.from('v_stock_summary').select('*').order('title')

  const totalValue = (rows ?? []).reduce((s, r) => s + Number(r.stock_value_at_cost ?? 0), 0)
  const totalUnits = (rows ?? []).reduce((s, r) => s + Number(r.on_hand ?? 0), 0)

  return (
    <div className="space-y-4">
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
                    {r.avg_unit_cost != null ? formatBaht(Number(r.avg_unit_cost)) : '—'}
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
