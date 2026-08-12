import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from '../../CustomerGate'
import { AddToCart } from './AddToCart'
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

  const { data: stock } = await supabase
    .from('v_public_stock')
    .select('available_to_sell')
    .eq('book_id', id)
    .maybeSingle()

  const available = Number(stock?.available_to_sell ?? 0)
  const isPreorder = book.stock_mode !== 'stock'

  return (
    <div className="space-y-4">
      <Link href="/shop" className="text-sm text-teal-700">← กลับหน้ารายการ</Link>

      <div className="card space-y-3">
        <div className="flex gap-4">
          <div className="flex h-40 w-28 shrink-0 items-center justify-center rounded bg-neutral-100 text-xs text-neutral-400">
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.cover_url as string} alt="" className="h-full w-full rounded object-cover" />
            ) : (
              'ไม่มีปก'
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">{book.title as string}</h1>
            <p className="mt-1 text-sm text-neutral-600">{(book.author as string) ?? '—'}</p>
            <p className="text-sm text-neutral-500">{(book.publisher as string) ?? ''}</p>
            <p className="mt-3 text-2xl font-semibold text-teal-800">
              {formatBaht(Number(book.sell_price))}
            </p>
            <p className="mt-1 text-sm">
              {isPreorder ? (
                <span className="text-amber-700">
                  เปิดจอง · คาดว่าของเข้า {formatDate(book.preorder_release_date as string)}
                </span>
              ) : available > 0 ? (
                <span className="text-teal-700">พร้อมส่ง (เหลือ {available} เล่ม)</span>
              ) : (
                <span className="text-neutral-400">สินค้าหมด</span>
              )}
            </p>
          </div>
        </div>

        <AddToCart
          bookId={book.id as string}
          max={isPreorder ? 99 : available}
          disabled={!isPreorder && available <= 0}
          isPreorder={isPreorder}
        />
      </div>

      {book.description && (
        <div className="card">
          <h2 className="mb-2 font-medium">เรื่องย่อ</h2>
          <p className="whitespace-pre-line text-sm text-neutral-700">
            {book.description as string}
          </p>
        </div>
      )}

      <div className="card text-sm">
        <h2 className="mb-2 font-medium">รายละเอียด</h2>
        <dl className="grid grid-cols-3 gap-y-1.5 text-neutral-600">
          <dt>ISBN</dt><dd className="col-span-2">{(book.isbn as string) ?? '—'}</dd>
          <dt>สำนักพิมพ์</dt><dd className="col-span-2">{(book.publisher as string) ?? '—'}</dd>
          <dt>จำนวนหน้า</dt><dd className="col-span-2">{(book.page_count as number) ?? '—'}</dd>
          <dt>น้ำหนัก</dt><dd className="col-span-2">{book.weight_grams as number} กรัม</dd>
        </dl>
      </div>

      <p className="text-center text-xs text-neutral-500">
        ค่าส่ง 40 บาท · ซื้อครบ 500 บาท ส่งฟรี
      </p>
    </div>
  )
}
