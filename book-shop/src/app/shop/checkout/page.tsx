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
    <div className="space-y-4">
      <Link href="/shop/cart" className="text-sm text-teal-700">← กลับตะกร้า</Link>
      <h1 className="text-lg font-semibold">ยืนยันคำสั่งซื้อ</h1>

      {summary.map((g) => (
        <div key={g.label} className="card space-y-2 text-sm">
          <div className="font-medium">
            {g.label}
            {summary.length > 1 && (
              <span className="ml-2 text-xs font-normal text-neutral-500">
                (แยกเป็นคนละคำสั่งซื้อ)
              </span>
            )}
          </div>
          {g.rows.map((r, i) => (
            <div key={i} className="flex justify-between text-neutral-700">
              <span className="min-w-0 truncate pr-2">
                {r.books!.title} × {r.qty}
              </span>
              <span className="shrink-0">
                {formatBaht(round2(r.qty * Number(r.books!.sell_price)))}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-neutral-100 pt-2 text-neutral-600">
            <span>ค่าส่ง</span>
            <span>{g.shipping === 0 ? 'ฟรี' : formatBaht(g.shipping)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>รวม</span>
            <span>{formatBaht(g.total)}</span>
          </div>
        </div>
      ))}

      <div className="card flex justify-between text-base font-semibold">
        <span>ยอดรวมทั้งหมด</span>
        <span>{formatBaht(grandTotal)}</span>
      </div>

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
