import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, getCurrentUser, can } from '@/lib/auth/permissions'
import { OrderActions } from './OrderActions'
import { formatBaht, formatDateTime, formatDate } from '@/lib/money'
import { payableAmount } from '@/lib/payment/promptpay'
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, PAYMENT_STATUS_LABEL } from '@/lib/orderStatus'
import { one, many } from '@/lib/embed'

export const dynamic = 'force-dynamic'

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('order.read')
  const { id } = await params
  const user = await getCurrentUser()
  const showCost = can(user, 'cost.read')
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_no, status, order_type, subtotal, discount, shipping_fee, total,
      deposit_amount, balance_due,
      cogs_total, shipping_actual_cost, channel_fee, gross_profit,
      created_at, paid_at, shipped_at, expected_release_date,
      shipping_address, customer_note,
      users ( display_name, line_user_id ),
      order_items ( title_snapshot, sku_snapshot, qty, unit_price, unit_cogs, line_total ),
      payments ( id, method, amount, slip_url, verify_status, created_at ),
      receipts ( receipt_no, issued_at ),
      shipments ( tracking_no, status, actual_cost )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!order) notFound()

  const addr = (order.shipping_address ?? {}) as Record<string, string>
  const payments = many<{
    id: string; method: string; amount: number; slip_url: string | null
    verify_status: string; created_at: string
  }>(order.payments)
  const receipt = one<{ receipt_no: string; issued_at: string }>(order.receipts)
  const shipment = one<{ tracking_no: string | null; actual_cost: number | null }>(order.shipments)
  const customer = one<{ display_name: string | null; line_user_id: string | null }>(order.users)
  const items = many<{
    title_snapshot: string; sku_snapshot: string | null; qty: number
    unit_price: number; unit_cogs: number | null; line_total: number
  }>(order.order_items)

  // ยอดที่ยังค้างอยู่จริง ณ ขั้นตอนนี้ — งวดสุดท้ายถ้าเป็นออเดอร์มัดจำ
  const status = order.status as string
  const isBalanceStage = status === 'awaiting_balance'
  const dueNow = isBalanceStage
    ? Number(order.balance_due ?? 0)
    : Number(order.deposit_amount ?? order.total)

  // มีสลิปรออยู่ก็ให้ตรวจสลิปไปตามปกติ ปุ่มนี้ไว้ใช้เฉพาะตอนไม่มีหลักฐานให้ตรวจ
  const hasPendingSlip = payments.some((p) => p.verify_status === 'pending')
  const canConfirmManually =
    !hasPendingSlip &&
    (isBalanceStage || status === 'pending_payment' || status === 'preorder_waiting')

  return (
    <div className="space-y-5">
      <Link href="/admin/orders" className="text-sm text-teal-700">← คำสั่งซื้อทั้งหมด</Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{order.order_no as string}</h1>
        <span className={`badge ${ORDER_STATUS_STYLE[order.status as string] ?? ''}`}>
          {ORDER_STATUS_LABEL[order.status as string]}
        </span>
        {order.order_type === 'preorder' && (
          <span className="badge bg-amber-50 text-amber-700">
            สั่งจอง · ของเข้า {formatDate(order.expected_release_date as string)}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-0">
            <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">รายการสินค้า</h2>
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="th">SKU</th>
                  <th className="th">ชื่อ</th>
                  <th className="th text-right">จำนวน</th>
                  <th className="th text-right">ราคา</th>
                  {showCost && <th className="th text-right">ต้นทุน/เล่ม</th>}
                  <th className="th text-right">รวม</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="td font-mono text-xs">{it.sku_snapshot ?? '—'}</td>
                    <td className="td">{it.title_snapshot}</td>
                    <td className="td text-right">{it.qty}</td>
                    <td className="td text-right">{formatBaht(Number(it.unit_price))}</td>
                    {showCost && (
                      <td className="td text-right text-neutral-500">
                        {/* เทียบกับ null ตรงๆ ไม่ใช้ค่าความจริง เพราะต้นทุน 0 บาท
                            (เช่นของแถม ของตัวอย่าง) เป็นค่าที่ถูกต้อง ไม่ใช่ "ยังไม่ตัด" */}
                        {it.unit_cogs != null ? formatBaht(Number(it.unit_cogs)) : 'ยังไม่ตัดสต็อก'}
                      </td>
                    )}
                    <td className="td text-right font-medium">{formatBaht(Number(it.line_total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card space-y-3">
            <h2 className="font-medium">การชำระเงิน</h2>
            {payments.length === 0 && (
              <p className="text-sm text-neutral-500">ลูกค้ายังไม่ได้ส่งสลิป</p>
            )}

            {/* ทางออกสำหรับออเดอร์ที่ลูกค้าโอนแล้วแต่ไม่ได้อัปโหลดสลิป
                ถ้าไม่มีปุ่มนี้ ออเดอร์จะค้างสถานะรอชำระเงินไปตลอด */}
            {canConfirmManually && (
              <OrderActions
                mode="manual-paid"
                orderId={order.id as string}
                amountLabel={formatBaht(dueNow)}
              />
            )}
            {payments.map((p) => (
              <div key={p.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>{formatDateTime(p.created_at)}</span>
                  <span className="badge bg-neutral-100 text-neutral-700">
                    {PAYMENT_STATUS_LABEL[p.verify_status] ?? p.verify_status}
                  </span>
                </div>
                <div className="mt-1 text-neutral-600">
                  ยอดในระบบ {formatBaht(Number(p.amount))} · ยอดที่ลูกค้าควรโอน{' '}
                  <strong>{formatBaht(payableAmount(Number(order.total), order.order_no as string))}</strong>
                </div>
                <OrderActions
                  mode="verify"
                  orderId={order.id as string}
                  paymentId={p.id}
                  slipPath={p.slip_url}
                  disabled={p.verify_status !== 'pending'}
                />
              </div>
            ))}
          </section>

          {(order.status === 'paid' || order.status === 'packing') && (
            <section className="card">
              <h2 className="mb-3 font-medium">บันทึกการจัดส่ง</h2>
              <OrderActions mode="ship" orderId={order.id as string} />
            </section>
          )}

          {shipment?.tracking_no && (
            <section className="card text-sm">
              <h2 className="mb-1 font-medium">พัสดุ</h2>
              <p>
                เลขพัสดุ <span className="font-mono">{shipment.tracking_no}</span>
                {shipment.actual_cost != null && (
                  <> · ค่าส่งจริง {formatBaht(Number(shipment.actual_cost))}</>
                )}
              </p>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="card space-y-1.5 text-sm">
            <h2 className="font-medium">สรุปยอด</h2>
            <Row label="ค่าสินค้า" value={formatBaht(Number(order.subtotal))} />
            <Row label="ค่าส่งที่เก็บ" value={formatBaht(Number(order.shipping_fee))} />
            <Row label="รวมที่ลูกค้าจ่าย" value={formatBaht(Number(order.total))} strong />
            {showCost && (
              <>
                <div className="border-t border-neutral-100 pt-1.5" />
                <Row
                  label="ต้นทุนสินค้า"
                  value={order.cogs_total != null ? formatBaht(Number(order.cogs_total)) : 'ยังไม่ตัดสต็อก'}
                />
                <Row
                  label="ค่าส่งที่จ่ายจริง"
                  value={order.shipping_actual_cost != null ? formatBaht(Number(order.shipping_actual_cost)) : '—'}
                />
                <Row label="ค่าธรรมเนียมช่องทาง" value={formatBaht(Number(order.channel_fee))} />
                <Row
                  label="กำไรขั้นต้น"
                  value={order.cogs_total != null ? formatBaht(Number(order.gross_profit)) : 'รอตัดสต็อก'}
                  strong
                />
              </>
            )}
          </section>

          <section className="card text-sm">
            <h2 className="mb-1 font-medium">ลูกค้าและที่อยู่</h2>
            <p className="text-neutral-700">
              {customer?.display_name ?? 'ไม่ระบุ'}
              <br />
              {addr.recipient_name} · {addr.phone}
              <br />
              {addr.line1} {addr.subdistrict} {addr.district}
              <br />
              {addr.province} {addr.postcode}
              {addr.carrier && <><br />ขนส่งที่ลูกค้าเลือก: {addr.carrier}</>}
            </p>
            {order.customer_note && (
              <p className="mt-2 rounded bg-neutral-50 p-2 text-xs text-neutral-600">
                หมายเหตุ: {order.customer_note as string}
              </p>
            )}
          </section>

          {receipt && (
            <section className="card text-sm">
              <h2 className="mb-1 font-medium">ใบเสร็จรับเงิน</h2>
              <p className="font-mono">{receipt.receipt_no}</p>
              <p className="text-neutral-500">{formatDateTime(receipt.issued_at)}</p>
            </section>
          )}

          {(order.status === 'pending_payment' || order.status === 'preorder_waiting') && (
            <section className="card">
              <OrderActions mode="cancel" orderId={order.id as string} />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-semibold' : 'text-neutral-600'}`}>
      <span>{label}</span>
      <span className={strong ? '' : 'text-neutral-800'}>{value}</span>
    </div>
  )
}
