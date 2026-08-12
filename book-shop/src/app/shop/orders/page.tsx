import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from '../CustomerGate'
import { formatBaht, formatDateTime } from '@/lib/money'
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from '@/lib/orderStatus'

export const dynamic = 'force-dynamic'

export default async function MyOrdersPage() {
  const customer = await getCustomer()
  if (!customer) return <CustomerGate />

  const supabase = await createClient()
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_no, status, total, created_at, order_type')
    .eq('user_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (!orders?.length) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-neutral-600">ยังไม่มีคำสั่งซื้อ</p>
        <Link href="/shop" className="btn-primary inline-flex">เลือกหนังสือ</Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">ออเดอร์ของฉัน</h1>
      {orders.map((o) => (
        <Link key={o.id as string} href={`/shop/orders/${o.id}`} className="card block hover:border-teal-400">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm">{o.order_no as string}</span>
            <span className={`badge ${ORDER_STATUS_STYLE[o.status as string] ?? ''}`}>
              {ORDER_STATUS_LABEL[o.status as string] ?? (o.status as string)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm text-neutral-600">
            <span>{formatDateTime(o.created_at as string)}</span>
            <span className="font-medium text-neutral-900">{formatBaht(Number(o.total))}</span>
          </div>
          {o.order_type === 'preorder' && (
            <span className="badge mt-1 bg-amber-50 text-amber-700">สั่งจองล่วงหน้า</span>
          )}
        </Link>
      ))}
    </div>
  )
}
