import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from '../CustomerGate'
import { FavouriteButton } from '@/components/FavouriteButton'
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
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">รายการโปรด</h1>
        <p className="mt-1 text-sm text-neutral-600">
          หนังสือที่คุณติดดาวไว้ — เล่มที่ของหมด เราจะแจ้งให้ทราบเมื่อของเข้า
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card space-y-2 text-center text-sm text-neutral-500">
          <p>ยังไม่มีหนังสือในรายการโปรด</p>
          <p>
            กดรูปดาวที่หน้าหนังสือเพื่อเก็บไว้ดูทีหลัง{' '}
            <Link href="/shop" className="text-teal-700">เลือกหนังสือ</Link>
          </p>
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
              <div key={b.id} className="card flex gap-3">
                <Link href={`/shop/books/${b.id}`} className="shrink-0">
                  <div className="flex h-24 w-16 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400">
                    {b.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.cover_url} alt="" className="h-full w-full rounded object-cover" />
                    ) : (
                      'ไม่มีปก'
                    )}
                  </div>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/shop/books/${b.id}`} className="block">
                    <div className="truncate font-medium">{b.title}</div>
                    <div className="truncate text-xs text-neutral-500">{b.author ?? '—'}</div>
                    <div className="mt-1 font-semibold text-teal-800">
                      {formatBaht(Number(b.sell_price))}
                    </div>
                  </Link>
                  <div className="mt-1 text-xs">
                    {!b.is_active ? (
                      <span className="text-neutral-400">เลิกจำหน่ายแล้ว</span>
                    ) : isPreorder ? (
                      <span className="text-amber-700">
                        เปิดจอง · ของเข้า {formatDate(b.preorder_release_date ?? '')}
                      </span>
                    ) : available > 0 ? (
                      <span className="text-teal-700">พร้อมส่ง (เหลือ {available} เล่ม)</span>
                    ) : (
                      <span className="text-neutral-400">ของหมด · รอแจ้งเตือน</span>
                    )}
                  </div>
                  <div className="mt-2">
                    <FavouriteButton bookId={b.id} initialStarred />
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
