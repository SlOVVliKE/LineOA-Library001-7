import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { formatBaht, formatDateTime } from '@/lib/money'
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from '@/lib/orderStatus'
import { many } from '@/lib/embed'

const TABS = [
  { key: 'all',              label: 'ทั้งหมด' },
  { key: 'pending_payment',  label: 'รอชำระเงิน' },
  { key: 'to_ship',          label: 'ชำระแล้ว รอส่ง' },
  { key: 'preorder_waiting', label: 'รอของเข้า' },
  { key: 'awaiting_balance', label: 'รอชำระส่วนที่เหลือ' },
  { key: 'shipped',          label: 'จัดส่งแล้ว' },
]

// 'to_ship' ไม่ใช่ค่า status จริงในฐานข้อมูล — เป็นตัวกรองรวมสองสถานะที่หน้า
// รายละเอียดออเดอร์ก็ปฏิบัติเหมือนเป็นกลุ่มเดียวกันอยู่แล้ว (ปุ่ม "จัดส่ง" โชว์ทั้ง
// paid และ packing) เพื่อให้ลิงก์จากหน้า "งานวันนี้" กรองมาถูกกลุ่มเดียวกัน
const STATUS_FILTERS: Record<string, string[]> = {
  to_ship: ['paid', 'packing'],
}

/**
 * รายการออเดอร์ฝั่งซ้ายของหน้าคำสั่งซื้อ — ใช้ร่วมกันทั้งสองโหมด:
 * `@list/page.tsx` (ตอนยังไม่เลือกออเดอร์ไหน) และ `@list/default.tsx`
 * (ตอนเลือกออเดอร์แล้ว ซึ่ง URL มี /[id] ต่อท้ายที่ @list เองไม่ match)
 *
 * โค้ดเดียวกันทั้งสองที่ ไม่งั้นแท็บกรอง/query จะเพี้ยนกันระหว่างสองโหมด
 */
export async function OrderListPane({
  status,
  selectedId,
}: {
  status?: string
  selectedId?: string
}) {
  await requirePermission('order.read')
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
  const qs = status ? `?status=${status}` : ''

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">คำสั่งซื้อ</h1>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders${selectedId ? `/${selectedId}` : ''}?status=${t.key}`}
            className={`badge border ${
              (status ?? 'all') === t.key
                ? 'badge-info'
                : 'border-neutral-300 text-neutral-600'
            }`}
            style={(status ?? 'all') === t.key ? { borderColor: 'var(--info)' } : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="card divide-y divide-neutral-100 overflow-y-auto p-0">
        {(orders ?? []).map((o) => {
          const payments = many<{ verify_status: string }>(o.payments)
          const waiting = payments.some((p) => p.verify_status === 'pending')
          const active = o.id === selectedId
          return (
            <Link
              key={o.id as string}
              href={`/admin/orders/${o.id}${qs}`}
              className={`block px-3 py-2.5 text-sm transition ${
                active ? '' : 'hover:bg-neutral-50'
              }`}
              style={active ? { background: 'var(--info-bg)' } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="a-link font-mono text-xs">{o.order_no as string}</span>
                <span className="font-medium">{formatBaht(Number(o.total))}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-neutral-500">{formatDateTime(o.created_at as string)}</span>
                <div className="flex items-center gap-1">
                  {waiting && <span className="badge bg-red-50 text-red-700">รอตรวจ</span>}
                  <span className={`badge ${ORDER_STATUS_STYLE[o.status as string] ?? ''}`}>
                    {ORDER_STATUS_LABEL[o.status as string]}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
        {!orders?.length && (
          <p className="px-3 py-8 text-center text-sm text-neutral-500">ยังไม่มีคำสั่งซื้อ</p>
        )}
      </div>
    </div>
  )
}
