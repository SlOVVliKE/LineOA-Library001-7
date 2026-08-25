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
      <div className="card py-12 text-center">
        <p className="t-body">ยังไม่มีคำสั่งซื้อ</p>
        <p className="t-meta mt-1">เมื่อสั่งซื้อแล้ว สถานะทุกขั้นจะแสดงที่นี่</p>
        <Link href="/shop" className="btn-primary mt-5 inline-flex">เลือกหนังสือ</Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="t-heading">ออเดอร์ของฉัน</h1>

      <div className="space-y-2.5">
        {orders.map((o) => (
          <Link
            key={o.id as string}
            href={`/shop/orders/${o.id}`}
            className="card block transition active:scale-[0.99]"
          >
            {/* ยอดเงินขึ้นก่อนเลขที่ออเดอร์ เพราะเวลากลับมาดูรายการเก่า
                คนจำยอดได้ แต่แทบไม่มีใครจำเลขที่ออเดอร์ */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="price-sm">{formatBaht(Number(o.total))}</div>
                <div className="t-meta mt-0.5 font-mono text-[12px]">
                  {o.order_no as string}
                </div>
              </div>
              <span className={`badge shrink-0 ${ORDER_STATUS_STYLE[o.status as string] ?? ''}`}>
                {ORDER_STATUS_LABEL[o.status as string] ?? (o.status as string)}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="t-micro">{formatDateTime(o.created_at as string)}</span>
              {o.order_type === 'preorder' && (
                <span className="badge badge-warn">สั่งจอง</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
