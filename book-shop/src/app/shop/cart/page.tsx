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
      <div className="card py-12 text-center">
        <p className="t-body">ยังไม่มีสินค้าในตะกร้า</p>
        <p className="t-meta mt-1">เลือกหนังสือที่ถูกใจแล้วกดใส่ตะกร้าได้เลย</p>
        <Link href="/shop" className="btn-primary mt-5 inline-flex">
          เลือกหนังสือ
        </Link>
      </div>
    )
  }

  const subtotal = round2(items.reduce((s, i) => s + i.qty * i.price, 0))
  const shipping = calcShippingFee(subtotal)
  const total = round2(subtotal + shipping)
  const hasBoth = items.some((i) => i.isPreorder) && items.some((i) => !i.isPreorder)
  const toFreeShipping = round2(DEFAULT_SHIPPING_RULE.freeThreshold - subtotal)

  return (
    <div className="space-y-3">
      <h1 className="t-heading">ตะกร้า</h1>

      <CartList items={items} />

      {/* ตัวชวนให้ซื้อเพิ่มเพื่อส่งฟรี วางแยกเป็นแถบของตัวเอง
          ของเดิมเป็นบรรทัดเล็กๆ ปนอยู่ในสรุปยอดจนแทบไม่มีใครเห็น */}
      {shipping > 0 && (
        <p
          className="rounded-xl px-3.5 py-2.5 text-[13px]"
          style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}
        >
          ซื้อเพิ่มอีก {formatBaht(toFreeShipping)} ได้ส่งฟรี
        </p>
      )}

      {hasBoth && (
        <p
          className="rounded-xl px-3.5 py-2.5 text-[13px]"
          style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}
        >
          ตะกร้ามีทั้งของพร้อมส่งและของสั่งจอง ระบบจะแยกเป็น 2 คำสั่งซื้อ
          เพื่อไม่ให้ของพร้อมส่งค้างรอ — ค่าส่งจึงคิดแยกกัน ยอดจริงจะแสดงในหน้าถัดไป
        </p>
      )}

      <div className="card space-y-2.5">
        <Row label="ค่าสินค้า" value={formatBaht(subtotal)} />
        <Row label="ค่าส่ง" value={shipping === 0 ? 'ฟรี' : formatBaht(shipping)} />
        <div
          className="flex items-center justify-between border-t pt-2.5"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="t-body">รวมทั้งสิ้น</span>
          <span className="price">{formatBaht(total)}</span>
        </div>
      </div>

      <div className="dock -mx-4">
        <div className="mx-auto max-w-3xl">
          <Link href="/shop/checkout" className="btn-primary w-full">
            ดำเนินการสั่งซื้อ · {formatBaht(total)}
          </Link>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="t-meta">{label}</span>
      <span className="tabular text-[15px]">{value}</span>
    </div>
  )
}
