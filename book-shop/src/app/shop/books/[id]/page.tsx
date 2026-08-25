import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from '../../CustomerGate'
import { AddToCart } from './AddToCart'
import { FavouriteButton } from '@/components/FavouriteButton'
import { BookCover } from '@/components/BookCover'
import { formatBaht, formatDate } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await getCustomer()
  if (!customer) return <CustomerGate />

  const { id } = await params
  const supabase = await createClient()

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()

  if (!book) notFound()

  const [{ data: stock }, { data: favourite }] = await Promise.all([
    supabase.from('v_public_stock').select('available_to_sell').eq('book_id', id).maybeSingle(),
    supabase
      .from('book_favourites')
      .select('book_id')
      .eq('user_id', customer.id)
      .eq('book_id', id)
      .maybeSingle(),
  ])

  const available = Number(stock?.available_to_sell ?? 0)
  const isPreorder = book.stock_mode !== 'stock'
  const soldOut = !isPreorder && available <= 0

  const details: [string, string][] = [
    ['ISBN', (book.isbn as string) || '—'],
    ['สำนักพิมพ์', (book.publisher as string) || '—'],
    ['จำนวนหน้า', book.page_count ? `${book.page_count} หน้า` : '—'],
    ['น้ำหนัก', `${book.weight_grams} กรัม`],
  ]

  return (
    <div className="space-y-3">
      <Link
        href="/shop"
        className="inline-flex min-h-[44px] items-center gap-1 text-[14px]"
        style={{ color: 'var(--ink-muted)' }}
      >
        ← กลับหน้ารายการ
      </Link>

      <div className="card space-y-4">
        <div className="flex gap-4">
          <BookCover
            url={book.cover_url as string | null}
            className="h-[168px] w-[112px] shrink-0 rounded-xl"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="text-[19px]" style={{ lineHeight: 1.5 }}>
              {book.title as string}
            </h1>
            {book.author && <p className="t-meta mt-1">{book.author as string}</p>}

            <div className="mt-auto pt-3">
              <div className="price">{formatBaht(Number(book.sell_price))}</div>
              <div className="mt-2">
                {isPreorder ? (
                  <span className="badge badge-warn">
                    เปิดจอง · ของเข้า {formatDate(book.preorder_release_date as string)}
                  </span>
                ) : soldOut ? (
                  <span className="badge badge-quiet">สินค้าหมด</span>
                ) : (
                  <span className="badge badge-ok">พร้อมส่ง · เหลือ {available} เล่ม</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {isPreorder && (
          <p
            className="rounded-xl px-3.5 py-2.5 text-[13px]"
            style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}
          >
            สินค้าสั่งจองจะแยกเป็นคำสั่งซื้อคนละใบกับของพร้อมส่ง และคิดค่าส่งแยกกัน
          </p>
        )}

        <div className="border-t pt-3.5" style={{ borderColor: 'var(--line)' }}>
          <FavouriteButton
            bookId={book.id as string}
            initialStarred={Boolean(favourite)}
            showLabel
          />
        </div>
      </div>

      {book.description && (
        <section className="card">
          <h2 className="t-heading mb-2">เรื่องย่อ</h2>
          <p className="t-body whitespace-pre-line">{book.description as string}</p>
        </section>
      )}

      <section className="card">
        <h2 className="t-heading mb-3">รายละเอียด</h2>
        {/* แถวละคู่ พร้อมเส้นคั่นบางๆ — อ่านง่ายกว่า grid สามคอลัมน์เดิม
            ที่ค่ายาวๆ อย่างชื่อสำนักพิมพ์จะดันขึ้นบรรทัดใหม่จนแถวไม่ตรงกัน */}
        <dl className="divide-y" style={{ borderColor: 'var(--line)' }}>
          {details.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="t-meta shrink-0">{k}</dt>
              <dd className="t-body text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="t-micro py-1 text-center">ค่าส่ง 40 บาท · ซื้อครบ 500 บาท ส่งฟรี</p>

      {/* แถบซื้อติดขอบล่างจอ อยู่ในสายตาตลอดไม่ว่าเลื่อนไปไหน */}
      <div className="dock -mx-4">
        <div className="mx-auto max-w-3xl">
          <AddToCart
            bookId={book.id as string}
            max={isPreorder ? 99 : available}
            disabled={soldOut}
            isPreorder={isPreorder}
          />
        </div>
      </div>
    </div>
  )
}
