import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from '../CustomerGate'
import { FavouriteButton } from '@/components/FavouriteButton'
import { BookCover } from '@/components/BookCover'
import { formatBaht, formatDate } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function FavouritesPage() {
  const customer = await getCustomer()
  if (!customer) return <CustomerGate />

  const supabase = await createClient()

  const { data: favourites } = await supabase
    .from('book_favourites')
    .select('book_id, created_at, books(id, title, author, sell_price, cover_url, stock_mode, preorder_release_date, is_active)')
    .eq('user_id', customer.id)
    .order('created_at', { ascending: false })

  const rows = (favourites ?? []).filter((f) => f.books)
  const bookIds = rows.map((f) => f.book_id as string)

  const { data: stock } = bookIds.length
    ? await supabase.from('v_public_stock').select('book_id, available_to_sell').in('book_id', bookIds)
    : { data: [] }

  const stockMap = new Map(
    (stock ?? []).map((s) => [s.book_id as string, Number(s.available_to_sell)])
  )

  return (
    <div className="space-y-3">
      <div>
        <h1 className="t-heading">รายการโปรด</h1>
        <p className="t-meta mt-1">
          เล่มที่ของหมด เราจะแจ้งเข้า LINE ให้เมื่อของเข้าใหม่
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="t-body">ยังไม่มีหนังสือในรายการโปรด</p>
          <p className="t-meta mt-1">กดรูปดาวที่หน้าหนังสือเพื่อเก็บไว้ดูทีหลัง</p>
          <Link href="/shop" className="btn-ghost mt-5 inline-flex">
            เลือกหนังสือ
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((f) => {
            // books เป็น object เดี่ยวเพราะ FK ชี้ไปแถวเดียว แต่ type ที่ generate มาเป็น array
            const b = f.books as unknown as {
              id: string; title: string; author: string | null; sell_price: number
              cover_url: string | null; stock_mode: string
              preorder_release_date: string | null; is_active: boolean
            }
            const available = stockMap.get(b.id) ?? 0
            const isPreorder = b.stock_mode !== 'stock'

            return (
              <div key={b.id} className="card flex gap-3.5">
                <Link href={`/shop/books/${b.id}`} className="shrink-0">
                  <BookCover url={b.cover_url} className="h-[108px] w-[72px] rounded-lg" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/shop/books/${b.id}`} className="block">
                    <h3 className="t-title line-clamp-2">{b.title}</h3>
                    {b.author && <p className="t-meta mt-0.5 line-clamp-1">{b.author}</p>}
                  </Link>

                  <div className="mt-auto pt-2">
                    <Link href={`/shop/books/${b.id}`} className="price block">
                      {formatBaht(Number(b.sell_price))}
                    </Link>

                    <div className="mt-1.5">
                      {!b.is_active ? (
                        <span className="badge badge-quiet">เลิกจำหน่ายแล้ว</span>
                      ) : isPreorder ? (
                        <span className="badge badge-warn">
                          เปิดจอง · ของเข้า {formatDate(b.preorder_release_date ?? '')}
                        </span>
                      ) : available > 0 ? (
                        <span className="badge badge-ok">พร้อมส่ง · เหลือ {available} เล่ม</span>
                      ) : (
                        <span className="badge badge-quiet">ของหมด · รอแจ้งเตือน</span>
                      )}
                    </div>

                    <div className="mt-2.5">
                      <FavouriteButton bookId={b.id} initialStarred />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
