import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { formatBaht, formatDateTime } from '@/lib/money'
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from '@/lib/orderStatus'
import { one, many } from '@/lib/embed'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'all',              label: 'ทั้งหมด' },
  { key: 'pending_payment',  label: 'รอชำระเงิน' },
  { key: 'to_ship',          label: 'ชำระแล้ว รอส่ง' },
  { key: 'preorder_waiting', label: 'รอของเข้า' },
  { key: 'awaiting_balance', label: 'รอชำระส่วนที่เหลือ' },
  { key: 'shipped',          label: 'จัดส่งแล้ว' },
]

// 'to_ship' ไม่ใช่ค่า status จริงในฐานข้อมูล — เป็นตัวกรองรวมสองสถานะที่หน้า
// orders/[id] ก็ปฏิบัติเหมือนเป็นกลุ่มเดียวกันอยู่แล้ว (ดูปุ่ม "จัดส่ง" ที่โชว์ทั้ง
// paid และ packing) เพื่อให้ลิงก์จากหน้า "งานวันนี้" กรองมาถูกกลุ่มเดียวกัน
const STATUS_FILTERS: Record<string, string[]> = {
  to_ship: ['paid', 'packing'],
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requirePermission('order.read')
  const { status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select('id, order_no, status, order_type, total, created_at, channels(name_th), payments(verify_status)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status && status !== 'all') {
    const group = STATUS_FILTERS[status]
    query = group ? query.in('status', group) : query.eq('status', status)
  }

  const { data: orders } = await query

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">คำสั่งซื้อ</h1>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders?status=${t.key}`}
            className={`badge border ${
              (status ?? 'all') === t.key
                ? 'border-teal-600 bg-teal-50 text-teal-800'
                : 'border-neutral-300 text-neutral-600'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              <th className="th">เลขที่</th>
              <th className="th">วันเวลา</th>
              <th className="th">ช่องทาง</th>
              <th className="th">ประเภท</th>
              <th className="th text-right">ยอด</th>
              <th className="th">สถานะ</th>
              <th className="th">สลิป</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => {
              const payments = many<{ verify_status: string }>(o.payments)
              const waiting = payments.some((p) => p.verify_status === 'pending')
              return (
                <tr key={o.id as string} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="td">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-teal-700 hover:underline">
                      {o.order_no as string}
                    </Link>
                  </td>
                  <td className="td text-neutral-500">{formatDateTime(o.created_at as string)}</td>
                  <td className="td text-neutral-600">
                    {one<{ name_th: string }>(o.channels)?.name_th ?? '—'}
                  </td>
                  <td className="td">
                    {o.order_type === 'preorder' ? (
                      <span className="badge bg-amber-50 text-amber-700">สั่งจอง</span>
                    ) : (
                      <span className="text-neutral-400">ปกติ</span>
                    )}
                  </td>
                  <td className="td text-right font-medium">{formatBaht(Number(o.total))}</td>
                  <td className="td">
                    <span className={`badge ${ORDER_STATUS_STYLE[o.status as string] ?? ''}`}>
                      {ORDER_STATUS_LABEL[o.status as string]}
                    </span>
                  </td>
                  <td className="td">
                    {waiting && <span className="badge bg-red-50 text-red-700">รอตรวจ</span>}
                  </td>
                </tr>
              )
            })}
            {!orders?.length && (
              <tr>
                <td className="td py-8 text-center text-neutral-500" colSpan={7}>
                  ยังไม่มีคำสั่งซื้อ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
