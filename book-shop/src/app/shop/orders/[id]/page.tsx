import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from '../../CustomerGate'
import { SlipUpload } from './SlipUpload'
import { buildPromptPayQrSvg, payableAmount } from '@/lib/payment/promptpay'
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

  let qrSvg: string | null = null
  let qrError: string | null = null
  if (order.status === 'pending_payment' || isBalanceStage) {
    try {
      const svg = await buildPromptPayQrSvg(amountToPay)
      // ด่านกันพลาด: SVG ตัวนี้สร้างจากไลบรารีของเราเองโดยมีอินพุตแค่
      // PROMPTPAY_ID (จาก env) กับตัวเลขยอดเงิน ไม่มีข้อมูลจากลูกค้าเลย
      // แต่เพราะเราจะฝังมันแบบ raw HTML จึงเช็คซ้ำอีกชั้นว่าหน้าตาถูกต้อง
      // ก่อนปล่อยเข้าหน้าเว็บ ถ้าไลบรารีเปลี่ยนพฤติกรรมวันไหนจะได้ไม่หลุด
      qrSvg = svg.startsWith('<svg') && !/<script/i.test(svg) ? svg : null
      if (!qrSvg) qrError = 'สร้างคิวอาร์ไม่สำเร็จ — โอนตามยอดด้านบนได้เลย'
    } catch {
      qrError = 'ยังไม่ได้ตั้งค่า PROMPTPAY_ID — โอนตามเลขบัญชีที่แอดมินแจ้งได้เลย'
    }
  }

  const payments = (order.payments ?? []) as {
    id: string; verify_status: string; purpose: string; created_at: string
  }[]
  const shipment = ((order.shipments ?? []) as { tracking_no: string | null; status: string }[])[0]

  return (
    <div className="space-y-3">
      <Link
        href="/shop/orders"
        className="inline-flex min-h-[44px] items-center text-[14px]"
        style={{ color: 'var(--ink-muted)' }}
      >
        ← ออเดอร์ทั้งหมด
      </Link>

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="price">{formatBaht(Number(order.total))}</div>
            <div className="t-meta mt-0.5 font-mono text-[12px]">
              {order.order_no as string}
            </div>
          </div>
          <span className={`badge shrink-0 ${ORDER_STATUS_STYLE[order.status as string] ?? ''}`}>
            {ORDER_STATUS_LABEL[order.status as string]}
          </span>
        </div>

        <p className="t-micro mt-2">สั่งเมื่อ {formatDateTime(order.created_at as string)}</p>

        {order.order_type === 'preorder' && (
          <div
            className="mt-3 rounded-xl px-3.5 py-2.5 text-[13px]"
            style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}
          >
            <p>
              สั่งจองล่วงหน้า · คาดว่าของเข้า{' '}
              {formatDate(order.expected_release_date as string)} — จัดส่งตามลำดับการจอง
            </p>
            {order.status === 'preorder_waiting' && (
              <p className="mt-1">
                จองไว้เมื่อ{' '}
                {formatDateTime(
                  ((order.preorder_queue ?? []) as { queued_at: string }[])[0]?.queued_at
                )}
                {' '}· เราจะแจ้งเข้า LINE ทันทีที่ของถึงร้าน
              </p>
            )}
          </div>
        )}
      </div>

      {(order.status === 'pending_payment' || isBalanceStage) && (
        <section className="card space-y-3.5">
          <h2 className="t-heading">
            {isBalanceStage
              ? 'ชำระส่วนที่เหลือ'
              : order.is_deposit_only
                ? 'ชำระมัดจำเพื่อยืนยันการจอง'
                : 'ชำระเงิน'}
          </h2>

          {isBalanceStage && (
            <p className="t-meta">ของเข้าแล้ว ชำระส่วนที่เหลือเพื่อให้เราจัดส่งได้เลย</p>
          )}

          {order.is_deposit_only && (
            <div
              className="space-y-1 rounded-xl px-3.5 py-2.5 text-[13px]"
              style={{ background: 'var(--paper-sunken)', color: 'var(--ink-muted)' }}
            >
              <div className="flex justify-between">
                <span>ยอดรวมทั้งสิ้น</span>
                <span className="tabular">{formatBaht(Number(order.total))}</span>
              </div>
              <div className="flex justify-between">
                <span>มัดจำ</span>
                <span className="tabular">{formatBaht(Number(order.deposit_amount ?? 0))}</span>
              </div>
              <div className="flex justify-between">
                <span>ส่วนที่เหลือ (เก็บตอนของเข้า)</span>
                <span className="tabular">{formatBaht(Number(order.balance_due ?? 0))}</span>
              </div>
            </div>
          )}

          {/* ยอดที่ต้องโอนคือข้อมูลสำคัญที่สุดในหน้านี้ ทำให้ใหญ่ที่สุดและอยู่ในกรอบของตัวเอง
              เศษสตางค์ที่ไม่ซ้ำใครคือสิ่งที่ทำให้ระบบจับคู่สลิปได้เอง
              ถ้าลูกค้าปัดเศษทิ้ง ระบบจะจับคู่ไม่ได้แล้วต้องรอแอดมินตรวจมือ
              คำอธิบายจึงต้องอยู่ติดกับตัวเลข ไม่ใช่ไปอยู่ท้ายหน้า */}
          <div
            className="rounded-2xl px-4 py-4 text-center"
            style={{ background: 'var(--ok-bg)' }}
          >
            <div className="text-[13px]" style={{ color: 'var(--ok)' }}>ยอดที่ต้องโอน</div>
            <div
              className="tabular mt-1 text-[30px] font-bold"
              style={{ color: 'var(--ok)' }}
            >
              {formatBaht(amountToPay)}
            </div>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--ok)' }}>
              โอนให้ตรงทุกสตางค์ เศษสตางค์คือรหัสประจำออเดอร์นี้
              ระบบใช้จับคู่สลิปให้อัตโนมัติ
            </p>
          </div>

          {qrSvg && (
            <div className="text-center">
              {/* ฝัง SVG ตรงๆ ไม่ผ่าน <img> เพื่อให้เบราว์เซอร์วาดเป็นเวกเตอร์จริง
                  พื้นขาวรอบโค้ดคือส่วนหนึ่งของมาตรฐาน QR (quiet zone)
                  ห้ามตัดออก ไม่งั้นแอปธนาคารบางตัวจะอ่านไม่ออก */}
              {/* SVG ที่ได้มามีแต่ viewBox ไม่มี width/height ติดมาด้วย
                  ถ้าปล่อยไว้เบราว์เซอร์จะให้ขนาด default 300×150 แล้วบี้เป็นสี่เหลี่ยมผืนผ้า
                  บังคับ w-full h-auto ให้มันคำนวณสูงจากสัดส่วนใน viewBox เอง */}
              <div
                className="mx-auto w-56 overflow-hidden rounded-2xl border bg-white p-2
                           [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                style={{ borderColor: 'var(--line)' }}
                role="img"
                aria-label="คิวอาร์โค้ดพร้อมเพย์"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="t-micro mt-2">สแกนด้วยแอปธนาคาร ยอดจะถูกกรอกให้อัตโนมัติ</p>
            </div>
          )}
          {qrError && (
            <p
              className="rounded-xl px-3.5 py-2.5 text-[13px]"
              style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}
            >
              {qrError}
            </p>
          )}

          <div className="border-t pt-3.5" style={{ borderColor: 'var(--line)' }}>
            <SlipUpload
              orderId={order.id as string}
              purpose={isBalanceStage ? 'balance' : 'full'}
            />
          </div>

          {payments.length > 0 && (
            <div className="border-t pt-3" style={{ borderColor: 'var(--line)' }}>
              <div className="t-meta mb-1.5">สลิปที่ส่งแล้ว</div>
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between gap-3 py-1">
                  <span className="t-meta">
                    {formatDateTime(p.created_at)}
                    <span className="t-micro"> · {PAYMENT_PURPOSE_LABEL[p.purpose] ?? p.purpose}</span>
                  </span>
                  <span className="t-meta shrink-0">
                    {PAYMENT_STATUS_LABEL[p.verify_status] ?? p.verify_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {shipment?.tracking_no && (
        <section className="card">
          <h2 className="t-heading mb-1.5">การจัดส่ง</h2>
          <p className="t-body">
            เลขพัสดุ <span className="font-mono">{shipment.tracking_no}</span>
          </p>
        </section>
      )}

      <section className="card space-y-2.5">
        <h2 className="t-heading">รายการสินค้า</h2>
        {((order.order_items ?? []) as { title_snapshot: string; qty: number; unit_price: number; line_total: number }[]).map(
          (it, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="t-body line-clamp-2 flex-1">
                {it.title_snapshot}
                <span className="t-meta"> × {it.qty}</span>
              </span>
              <span className="tabular shrink-0 text-[15px]">
                {formatBaht(Number(it.line_total))}
              </span>
            </div>
          )
        )}
        <div
          className="flex justify-between border-t pt-2.5"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="t-meta">ค่าส่ง</span>
          <span className="tabular text-[15px]">
            {Number(order.shipping_fee) === 0 ? 'ฟรี' : formatBaht(Number(order.shipping_fee))}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="t-body">รวม</span>
          <span className="price-sm">{formatBaht(Number(order.total))}</span>
        </div>
      </section>

      <section className="card">
        <h2 className="t-heading mb-1.5">ที่อยู่จัดส่ง</h2>
        <p className="t-body">
          {addr.recipient_name} · {addr.phone}
          <br />
          {addr.line1} {addr.subdistrict} {addr.district}
          <br />
          {addr.province} {addr.postcode}
        </p>
      </section>
    </div>
  )
}
