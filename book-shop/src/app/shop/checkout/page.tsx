import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from '../CustomerGate'
import { CheckoutForm } from './CheckoutForm'
import { calcShippingFee, formatBaht, round2 } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const customer = await getCustomer()
  if (!customer) return <CustomerGate />

  const supabase = await createClient()

  const { data: cart } = await supabase
    .from('cart')
    .select('cart_items(qty, books(title, sell_price, stock_mode))')
    .eq('user_id', customer.id)
    .maybeSingle()

  type Row = {
    qty: number
    books: { title: string; sell_price: number; stock_mode: string } | null
  }
  const items = ((cart?.cart_items ?? []) as unknown as Row[]).filter((i) => i.books)
  if (items.length === 0) redirect('/shop/cart')

  const groups = [
    { label: 'พร้อมส่ง', rows: items.filter((i) => i.books!.stock_mode === 'stock') },
    { label: 'สั่งจองล่วงหน้า', rows: items.filter((i) => i.books!.stock_mode !== 'stock') },
  ].filter((g) => g.rows.length > 0)

  const summary = groups.map((g) => {
    const subtotal = round2(
      g.rows.reduce((s, r) => s + r.qty * Number(r.books!.sell_price), 0)
    )
    const shipping = calcShippingFee(subtotal)
    return { ...g, subtotal, shipping, total: round2(subtotal + shipping) }
  })

  const grandTotal = round2(summary.reduce((s, g) => s + g.total, 0))

  const { data: lastAddress } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="space-y-3">
      <Link
        href="/shop/cart"
        className="inline-flex min-h-[44px] items-center text-[14px]"
        style={{ color: 'var(--ink-muted)' }}
      >
        ← กลับตะกร้า
      </Link>

      <h1 className="t-heading">ยืนยันคำสั่งซื้อ</h1>

      {summary.map((g) => (
        <section key={g.label} className="card space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="t-body">{g.label}</h2>
            {summary.length > 1 && (
              <span className="t-micro">แยกเป็นคนละคำสั่งซื้อ</span>
            )}
          </div>

          {g.rows.map((r, i) => (
            <div key={i} className="flex justify-between gap-3">
              {/* ชื่อหนังสือขึ้นได้สองบรรทัด ไม่ตัดด้วยจุดไข่ปลา
                  ภาษาไทยไม่มีช่องว่างระหว่างคำ ตัดกลางคำแล้วเดาไม่ออกว่าเล่มไหน
                  ซึ่งเป็นปัญหาตรงหน้ายืนยันคำสั่งซื้อพอดี เพราะเป็นจุดที่ต้องตรวจ */}
              <span className="t-body line-clamp-2 flex-1">
                {r.books!.title}
                <span className="t-meta"> × {r.qty}</span>
              </span>
              <span className="tabular shrink-0 text-[15px]">
                {formatBaht(round2(r.qty * Number(r.books!.sell_price)))}
              </span>
            </div>
          ))}

          <div
            className="flex justify-between border-t pt-2.5"
            style={{ borderColor: 'var(--line)' }}
          >
            <span className="t-meta">ค่าส่ง</span>
            <span className="tabular text-[15px]">
              {g.shipping === 0 ? 'ฟรี' : formatBaht(g.shipping)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="t-body">รวม</span>
            <span className="price-sm">{formatBaht(g.total)}</span>
          </div>
        </section>
      ))}

      {/* แสดงยอดรวมทั้งหมดเฉพาะตอนมีมากกว่าหนึ่งคำสั่งซื้อ
          ถ้ามีใบเดียว การ์ดนี้จะซ้ำกับบรรทัด "รวม" ข้างบนแบบไม่ได้ให้ข้อมูลใหม่ */}
      {summary.length > 1 && (
        <div className="card flex items-center justify-between">
          <span className="t-body">ยอดรวมทั้งหมด</span>
          <span className="price">{formatBaht(grandTotal)}</span>
        </div>
      )}

      <CheckoutForm
        defaults={
          lastAddress
            ? {
                recipient_name: lastAddress.recipient_name as string,
                phone: lastAddress.phone as string,
                line1: lastAddress.line1 as string,
                subdistrict: (lastAddress.subdistrict as string) ?? '',
                district: (lastAddress.district as string) ?? '',
                province: lastAddress.province as string,
                postcode: lastAddress.postcode as string,
              }
            : undefined
        }
      />
    </div>
  )
}
