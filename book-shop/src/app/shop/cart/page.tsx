import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from '../CustomerGate'
import { CartList } from './CartList'
import { calcShippingFee, formatBaht, round2, DEFAULT_SHIPPING_RULE } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const customer = await getCustomer()
  if (!customer) return <CustomerGate />

  const supabase = await createClient()
  const { data: cart } = await supabase
    .from('cart')
    .select('id, cart_items(id, qty, books(id, title, sell_price, cover_url, stock_mode))')
    .eq('user_id', customer.id)
    .maybeSingle()

  type Row = {
    id: string
    qty: number
    books: {
      id: string; title: string; sell_price: number
      cover_url: string | null; stock_mode: string
    } | null
  }
  const items = ((cart?.cart_items ?? []) as unknown as Row[])
    .filter((i) => i.books)
    .map((i) => ({
      id: i.id,
      qty: i.qty,
      bookId: i.books!.id,
      title: i.books!.title,
      price: Number(i.books!.sell_price),
      coverUrl: i.books!.cover_url,
      isPreorder: i.books!.stock_mode !== 'stock',
    }))

  if (items.length === 0) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-neutral-600">ยังไม่มีสินค้าในตะกร้า</p>
        <Link href="/shop" className="btn-primary inline-flex">เลือกหนังสือ</Link>
      </div>
    )
  }

  const subtotal = round2(items.reduce((s, i) => s + i.qty * i.price, 0))
  const shipping = calcShippingFee(subtotal)
  const hasBoth = items.some((i) => i.isPreorder) && items.some((i) => !i.isPreorder)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">ตะกร้า</h1>

      <CartList items={items} />

      <div className="card space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-600">ค่าสินค้า</span>
          <span>{formatBaht(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-600">ค่าส่ง</span>
          <span>{shipping === 0 ? 'ฟรี' : formatBaht(shipping)}</span>
        </div>
        {shipping > 0 && (
          <p className="text-xs text-teal-700">
            ซื้อเพิ่มอีก {formatBaht(round2(DEFAULT_SHIPPING_RULE.freeThreshold - subtotal))} ส่งฟรี
          </p>
        )}
        <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold">
          <span>รวมทั้งสิ้น</span>
          <span>{formatBaht(round2(subtotal + shipping))}</span>
        </div>
      </div>

      {hasBoth && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ตะกร้ามีทั้งของพร้อมส่งและของสั่งจอง ระบบจะแยกเป็น 2 คำสั่งซื้อ
          เพื่อไม่ให้ของพร้อมส่งค้างรอ — ค่าส่งจึงคิดแยกกัน ยอดจริงจะแสดงในหน้าถัดไป
        </p>
      )}

      <Link href="/shop/checkout" className="btn-primary w-full">
        ดำเนินการสั่งซื้อ
      </Link>
    </div>
  )
}
