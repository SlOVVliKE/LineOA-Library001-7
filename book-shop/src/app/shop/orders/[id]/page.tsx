import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from '../../CustomerGate'
import { SlipUpload } from './SlipUpload'
import { buildPromptPayQrDataUrl, payableAmount } from '@/lib/payment/promptpay'
import { formatBaht, formatDateTime, formatDate } from '@/lib/money'
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, PAYMENT_STATUS_LABEL, PAYMENT_PURPOSE_LABEL } from '@/lib/orderStatus'

export const dynamic = 'force-dynamic'

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await getCustomer()
  if (!customer) return <CustomerGate />

  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_no, status, order_type, subtotal, shipping_fee, total,
      is_deposit_only, deposit_amount, balance_due,
      created_at, paid_at, shipped_at, expected_release_date,
      shipping_address, customer_note,
      order_items ( title_snapshot, qty, unit_price, line_total, fulfilled_qty ),
      payments ( id, amount, verify_status, purpose, created_at ),
      preorder_queue ( qty, qty_fulfilled, queued_at ),
      shipments ( tracking_no, carrier_id, status )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!order) notFound()

  const addr = (order.shipping_address ?? {}) as Record<string, string>
  const isBalanceStage = order.status === 'awaiting_balance'
  const dueNow = isBalanceStage
    ? Number(order.balance_due ?? 0)
    : Number(order.deposit_amount ?? order.total)
  const amountToPay = payableAmount(dueNow, order.order_no as string)

  let qrDataUrl: string | null = null
  let qrError: string | null = null
  if (order.status === 'pending_payment' || isBalanceStage) {
    try {
      qrDataUrl = await buildPromptPayQrDataUrl(amountToPay)
    } catch {
      qrError = 'ยังไม่ได้ตั้งค่า PROMPTPAY_ID — โอนตามเลขบัญชีที่แอดมินแจ้งได้เลย'
    }
  }

  const payments = (order.payments ?? []) as {
    id: string; verify_status: string; purpose: string; created_at: string
  }[]
  const shipment = ((order.shipments ?? []) as { tracking_no: string | null; status: string }[])[0]

  return (
    <div className="space-y-4">
      <Link href="/shop/orders" className="text-sm text-teal-700">← ออเดอร์ทั้งหมด</Link>

      <div className="card space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono">{order.order_no as string}</span>
          <span className={`badge ${ORDER_STATUS_STYLE[order.status as string] ?? ''}`}>
            {ORDER_STATUS_LABEL[order.status as string]}
          </span>
        </div>
        <div className="text-sm text-neutral-500">
          สั่งเมื่อ {formatDateTime(order.created_at as string)}
        </div>
        {order.order_type === 'preorder' && (
          <div className="mt-1 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <p>
              คำสั่งซื้อแบบสั่งจอง · คาดว่าของเข้า{' '}
              {formatDate(order.expected_release_date as string)}
              {' '}— จัดส่งตามลำดับการจอง ใครจองก่อนได้ก่อน
            </p>
            {order.status === 'preorder_waiting' && (
              <p className="mt-1">
                จองไว้เมื่อ{' '}
                {formatDateTime(
                  ((order.preorder_queue ?? []) as { queued_at: string }[])[0]?.queued_at
                )}
                {' '}· เราจะแจ้งทันทีที่ของถึงร้าน
              </p>
            )}
          </div>
        )}
      </div>

      {(order.status === 'pending_payment' || isBalanceStage) && (
        <div className="card space-y-3">
          <h2 className="font-medium">
            {isBalanceStage
              ? 'ของเข้าแล้ว — ชำระส่วนที่เหลือเพื่อให้เราจัดส่ง'
              : order.is_deposit_only
                ? 'ชำระมัดจำเพื่อยืนยันการจอง'
                : 'ชำระเงิน'}
          </h2>

          {order.is_deposit_only && (
            <p className="rounded bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              ยอดรวมทั้งสิ้น {formatBaht(Number(order.total))} ·
              มัดจำ {formatBaht(Number(order.deposit_amount ?? 0))} ·
              ส่วนที่เหลือ {formatBaht(Number(order.balance_due ?? 0))} เก็บตอนของเข้า
            </p>
          )}

          <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-center">
            <div className="text-xs text-teal-800">ยอดที่ต้องโอน</div>
            <div className="text-2xl font-semibold text-teal-900">{formatBaht(amountToPay)}</div>
            <p className="mt-1 text-xs text-teal-700">
              กรุณาโอนยอดนี้ให้ตรงทุกสตางค์ — เศษสตางค์คือรหัสประจำคำสั่งซื้อนี้
              ใช้จับคู่สลิปกับออเดอร์ให้อัตโนมัติ
            </p>
          </div>

          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="PromptPay QR" className="mx-auto w-56 rounded-lg border border-neutral-200" />
          )}
          {qrError && <p className="text-center text-xs text-amber-700">{qrError}</p>}

          <SlipUpload
            orderId={order.id as string}
            purpose={isBalanceStage ? 'balance' : 'full'}
          />

          {payments.length > 0 && (
            <div className="border-t border-neutral-100 pt-2 text-sm">
              <div className="mb-1 font-medium">สลิปที่ส่งแล้ว</div>
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between text-neutral-600">
                  <span>
                    {formatDateTime(p.created_at)}
                    <span className="ml-1 text-xs text-neutral-400">
                      ({PAYMENT_PURPOSE_LABEL[p.purpose] ?? p.purpose})
                    </span>
                  </span>
                  <span>{PAYMENT_STATUS_LABEL[p.verify_status] ?? p.verify_status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {shipment?.tracking_no && (
        <div className="card">
          <h2 className="mb-1 font-medium">การจัดส่ง</h2>
          <p className="text-sm">
            เลขพัสดุ <span className="font-mono">{shipment.tracking_no}</span>
          </p>
        </div>
      )}

      <div className="card space-y-2 text-sm">
        <h2 className="font-medium">รายการสินค้า</h2>
        {((order.order_items ?? []) as { title_snapshot: string; qty: number; unit_price: number; line_total: number }[]).map(
          (it, i) => (
            <div key={i} className="flex justify-between text-neutral-700">
              <span className="min-w-0 truncate pr-2">
                {it.title_snapshot} × {it.qty}
              </span>
              <span className="shrink-0">{formatBaht(Number(it.line_total))}</span>
            </div>
          )
        )}
        <div className="flex justify-between border-t border-neutral-100 pt-2 text-neutral-600">
          <span>ค่าส่ง</span>
          <span>{Number(order.shipping_fee) === 0 ? 'ฟรี' : formatBaht(Number(order.shipping_fee))}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>รวม</span>
          <span>{formatBaht(Number(order.total))}</span>
        </div>
      </div>

      <div className="card text-sm">
        <h2 className="mb-1 font-medium">ที่อยู่จัดส่ง</h2>
        <p className="text-neutral-700">
          {addr.recipient_name} · {addr.phone}
          <br />
          {addr.line1} {addr.subdistrict} {addr.district}
          <br />
          {addr.province} {addr.postcode}
        </p>
      </div>
    </div>
  )
}
