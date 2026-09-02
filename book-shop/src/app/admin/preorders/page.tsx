import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { FulfillButton } from './FulfillButton'
import { formatDate, formatDateTime, formatNumber } from '@/lib/money'
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from '@/lib/orderStatus'
import { Table, TableHead, TableRow, EmptyRow } from '@/components/admin/Table'

export const dynamic = 'force-dynamic'

export default async function PreordersPage() {
  await requirePermission('order.read')
  const supabase = await createClient()

  const [{ data: demand }, { data: queue }, { data: awaiting }] = await Promise.all([
    supabase.from('v_preorder_demand').select('*').order('first_queued_at'),
    supabase.from('v_preorder_queue_detail').select('*').order('book_id').order('queue_position'),
    supabase
      .from('orders')
      .select('id, order_no, total, deposit_amount, balance_due, created_at')
      .eq('status', 'awaiting_balance')
      .order('created_at'),
  ])

  const totalWaiting = (demand ?? []).reduce((s, d) => s + Number(d.qty_waiting ?? 0), 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">การสั่งจองล่วงหน้า</h1>
        <p className="mt-1 text-sm text-neutral-600">
          ระบบจ่ายของให้คิวอัตโนมัติทุกครั้งที่กด &ldquo;รับสินค้าเข้า&rdquo; โดยเรียงตามลำดับที่จองก่อน
          — หน้านี้ไว้ดูภาพรวมและจ่ายด้วยมือถ้าจำเป็น
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="เล่มที่ลูกค้ารออยู่" value={formatNumber(totalWaiting)} />
        <Stat label="หนังสือที่มีคิว" value={formatNumber(demand?.length ?? 0) + ' รายการ'} />
        <Stat label="รอชำระส่วนที่เหลือ" value={formatNumber(awaiting?.length ?? 0) + ' ออเดอร์'} />
      </div>

      <section className="a-card overflow-x-auto p-0">
        <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">ยอดจองสะสมรายเล่ม</h2>
        <table className="a-table">
          <TableHead>
            <th className="th">SKU</th>
            <th className="th">ชื่อหนังสือ</th>
            <th className="th">คาดว่าของเข้า</th>
            <th className="th text-right">รออยู่</th>
            <th className="th text-right">ออเดอร์</th>
            <th className="th text-right">มีของแล้ว</th>
            <th className="th"></th>
          </TableHead>
          <tbody>
            {(demand ?? []).map((d) => {
              const waiting = Number(d.qty_waiting)
              const onHand = Number(d.qty_on_hand)
              const canFulfill = onHand > 0
              return (
                <TableRow key={d.book_id as string}>
                  <td className="td font-mono text-xs">{d.sku}</td>
                  <td className="td">
                    <Link href={`/admin/books/${d.book_id}`} className="a-link">
                      {d.title}
                    </Link>
                  </td>
                  <td className="td">{formatDate(d.preorder_release_date as string)}</td>
                  <td className="td text-right font-medium text-amber-700">
                    {formatNumber(waiting)}
                  </td>
                  <td className="td text-right text-neutral-500">{formatNumber(Number(d.order_count))}</td>
                  <td className={`td text-right ${canFulfill ? 'font-medium' : 'text-neutral-400'}`}>
                    {formatNumber(onHand)}
                  </td>
                  <td className="td">
                    {canFulfill && <FulfillButton bookId={d.book_id as string} />}
                  </td>
                </TableRow>
              )
            })}
            {!demand?.length && <EmptyRow colSpan={7}>ยังไม่มีใครสั่งจอง</EmptyRow>}
          </tbody>
        </table>
      </section>

      {!!queue?.length && (
        <section className="a-card overflow-x-auto p-0">
          <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">
            คิวรายคน — ใครจองก่อนได้ก่อน
          </h2>
          <table className="a-table">
            <TableHead>
              <th className="th text-right">คิวที่</th>
              <th className="th">หนังสือ</th>
              <th className="th">ออเดอร์</th>
              <th className="th">ลูกค้า</th>
              <th className="th">จองเมื่อ</th>
              <th className="th text-right">จอง</th>
              <th className="th text-right">ได้แล้ว</th>
              <th className="th">สถานะออเดอร์</th>
            </TableHead>
            <tbody>
              {queue.map((q) => (
                <TableRow key={q.id as string}>
                  <td className="td text-right font-medium">{Number(q.queue_position)}</td>
                  <td className="td">{q.title}</td>
                  <td className="td">
                    <Link href={`/admin/orders/${q.order_id}`} className="a-link font-mono text-xs">
                      {q.order_no}
                    </Link>
                  </td>
                  <td className="td text-neutral-600">{(q.customer_name as string) ?? '—'}</td>
                  <td className="td text-neutral-500">{formatDateTime(q.queued_at as string)}</td>
                  <td className="td text-right">{Number(q.qty)}</td>
                  <td className="td text-right">{Number(q.qty_fulfilled)}</td>
                  <td className="td">
                    <span className={`badge ${ORDER_STATUS_STYLE[q.order_status as string] ?? ''}`}>
                      {ORDER_STATUS_LABEL[q.order_status as string]}
                    </span>
                  </td>
                </TableRow>
              ))}
            </tbody>
          </table>
          <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
            คิวที่สถานะออเดอร์เป็น &ldquo;รอชำระเงิน&rdquo; จะยังไม่ได้รับของ
            — ระบบจ่ายให้เฉพาะคนที่ชำระเงินแล้วเท่านั้น
          </p>
        </section>
      )}

      {!!awaiting?.length && (
        <section className="a-card overflow-x-auto p-0">
          <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">
            ของเข้าแล้ว รอลูกค้าชำระส่วนที่เหลือ
          </h2>
          <table className="a-table">
            <TableHead>
              <th className="th">ออเดอร์</th>
              <th className="th text-right">ยอดรวม</th>
              <th className="th text-right">มัดจำที่จ่ายแล้ว</th>
              <th className="th text-right">คงเหลือ</th>
            </TableHead>
            <tbody>
              {awaiting.map((o) => (
                <TableRow key={o.id as string}>
                  <td className="td">
                    <Link href={`/admin/orders/${o.id}`} className="a-link font-mono text-xs">
                      {o.order_no}
                    </Link>
                  </td>
                  <td className="td text-right">{Number(o.total).toFixed(2)}</td>
                  <td className="td text-right text-neutral-500">
                    {o.deposit_amount != null ? Number(o.deposit_amount).toFixed(2) : '—'}
                  </td>
                  <td className="td text-right font-medium text-amber-700">
                    {o.balance_due != null ? Number(o.balance_due).toFixed(2) : '—'}
                  </td>
                </TableRow>
              ))}
            </tbody>
          </table>
        </section>
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
