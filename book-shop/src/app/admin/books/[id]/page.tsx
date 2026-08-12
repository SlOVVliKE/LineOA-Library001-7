import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, getCurrentUser, can } from '@/lib/auth/permissions'
import { formatBaht, formatDate, formatDateTime, formatNumber } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('book.write')
  const { id } = await params
  const user = await getCurrentUser()
  const showCost = can(user, 'cost.read')
  const supabase = await createClient()

  const { data: book } = await supabase.from('books').select('*').eq('id', id).maybeSingle()
  if (!book) notFound()

  const { data: summary } = await supabase
    .from('v_stock_summary').select('*').eq('book_id', id).maybeSingle()

  const { data: lots } = showCost
    ? await supabase
        .from('purchase_lots')
        .select('*')
        .eq('book_id', id)
        .order('received_at', { ascending: true })
    : { data: null }

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('id, type, qty, unit_cost, reason, created_at')
    .eq('book_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{book.title as string}</h1>
        <p className="text-sm text-neutral-500">
          {book.sku as string} · {(book.author as string) ?? 'ไม่ระบุผู้แต่ง'} ·{' '}
          {formatBaht(Number(book.sell_price))}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="คงเหลือจริง" value={formatNumber(Number(summary?.on_hand ?? 0))} />
        <Stat label="ถูกจองไว้" value={formatNumber(Number(summary?.reserved ?? 0))} />
        <Stat label="ขายได้" value={formatNumber(Number(summary?.available_to_sell ?? 0))} />
        {showCost && (
          <Stat label="ต้นทุนเฉลี่ย"
            value={summary?.avg_unit_cost ? formatBaht(Number(summary.avg_unit_cost)) : '—'} />
        )}
      </div>

      {showCost && (
        <section className="card p-0">
          <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">
            ล็อตรับเข้า (เรียงตามลำดับที่จะถูกตัดแบบ FIFO)
          </h2>
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="th">ล็อต</th>
                <th className="th">วันที่ของมาถึง</th>
                <th className="th">วันที่บันทึก</th>
                <th className="th">ซัพพลายเออร์</th>
                <th className="th text-right">รับเข้า</th><th className="th text-right">เหลือ</th>
                <th className="th text-right">ราคาซื้อ</th><th className="th text-right">ค่าขนส่ง</th>
                <th className="th text-right">ต้นทุนจริง/เล่ม</th>
              </tr>
            </thead>
            <tbody>
              {(lots ?? []).map((l) => (
                <tr key={l.id as string}
                  className={`border-t border-neutral-100 ${
                    Number(l.qty_remaining) === 0 ? 'text-neutral-400' : ''}`}>
                  <td className="td font-mono text-xs">{(l.lot_no as string) ?? '—'}</td>
                  <td className="td">{formatDate(l.received_at as string)}</td>
                  <td className="td text-neutral-500">
                    {formatDateTime(l.created_at as string)}
                  </td>
                  <td className="td">{(l.supplier as string) ?? '—'}</td>
                  <td className="td text-right">{Number(l.qty_received)}</td>
                  <td className="td text-right font-medium">{Number(l.qty_remaining)}</td>
                  <td className="td text-right">{formatBaht(Number(l.unit_cost))}</td>
                  <td className="td text-right">{formatBaht(Number(l.shipping_cost))}</td>
                  <td className="td text-right font-medium text-teal-800">
                    {formatBaht(Number(l.landed_unit_cost))}
                  </td>
                </tr>
              ))}
              {!lots?.length && (
                <tr><td className="td py-6 text-center text-neutral-500" colSpan={9}>
                  ยังไม่มีการรับสินค้าเข้า
                </td></tr>
              )}
            </tbody>
          </table>
          <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
            ต้นทุนจริง/เล่ม = ราคาซื้อ + (ค่าขนส่งขาเข้า ÷ จำนวนที่รับ) — ค่านี้คือตัวที่ใช้คำนวณกำไร
            <br />
            &ldquo;วันที่ของมาถึง&rdquo; คือค่าที่ใช้เรียงลำดับ FIFO ส่วน &ldquo;วันที่บันทึก&rdquo; คือเวลาจริงที่กดบันทึกเข้าระบบ
          </p>
        </section>
      )}

      <section className="card p-0">
        <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">
          ความเคลื่อนไหวล่าสุด
        </h2>
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              <th className="th">วันเวลา</th><th className="th">ประเภท</th>
              <th className="th text-right">จำนวน</th>
              {showCost && <th className="th text-right">ต้นทุน/เล่ม</th>}
              <th className="th">เหตุผล</th>
            </tr>
          </thead>
          <tbody>
            {(movements ?? []).map((m) => (
              <tr key={m.id as string} className="border-t border-neutral-100">
                <td className="td text-neutral-500">{formatDateTime(m.created_at as string)}</td>
                <td className="td">{movementLabel(m.type as string)}</td>
                <td className={`td text-right font-medium ${
                  Number(m.qty) > 0 ? 'text-teal-700' : 'text-red-600'}`}>
                  {Number(m.qty) > 0 ? '+' : ''}{Number(m.qty)}
                </td>
                {showCost && (
                  <td className="td text-right">
                    {m.unit_cost ? formatBaht(Number(m.unit_cost)) : '—'}
                  </td>
                )}
                <td className="td text-neutral-500">{(m.reason as string) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function movementLabel(t: string): string {
  const map: Record<string, string> = {
    purchase: 'รับเข้า',
    sale: 'ขาย',
    adjust: 'ปรับสต็อก',
    return: 'รับคืน',
    damage: 'ของเสีย',
    channel_correction: 'แก้ไขจากช่องทางขาย',
  }
  return map[t] ?? t
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}
