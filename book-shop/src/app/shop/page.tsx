import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from './CustomerGate'
import { formatBaht, formatDate } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function ShopHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>
}) {
  const customer = await getCustomer()
  if (!customer) return <CustomerGate />

  const { q, cat } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('books')
    .select('id, sku, title, author, publisher, sell_price, cover_url, stock_mode, preorder_release_date, category_id')
    .eq('is_active', true)
    .order('title')
    .limit(60)

  if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%`)
  if (cat) query = query.eq('category_id', cat)

  const [{ data: books }, { data: stock }, { data: categories }] = await Promise.all([
    query,
    supabase.from('v_public_stock').select('book_id, available_to_sell'),
    supabase.from('categories').select('id, name').order('sort_order'),
  ])

  const stockMap = new Map(
    (stock ?? []).map((s) => [s.book_id as string, Number(s.available_to_sell)])
  )

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="ค้นหาชื่อหนังสือ ผู้แต่ง หรือ ISBN"
          className="input"
        />
        <button className="btn-ghost shrink-0">ค้นหา</button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/shop"
          className={`badge border ${!cat ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-neutral-300 text-neutral-600'}`}
        >
          ทั้งหมด
        </Link>
        {(categories ?? []).map((c) => (
          <Link
            key={c.id as string}
            href={`/shop?cat=${c.id}`}
            className={`badge border ${cat === c.id ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-neutral-300 text-neutral-600'}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(books ?? []).map((b) => {
          const available = stockMap.get(b.id as string) ?? 0
          const isPreorder = b.stock_mode !== 'stock'
          return (
            <Link
              key={b.id as string}
              href={`/shop/books/${b.id}`}
              className="card flex gap-3 hover:border-teal-400"
            >
              <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400">
                {b.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover_url as string} alt="" className="h-full w-full rounded object-cover" />
                ) : (
                  'ไม่มีปก'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{b.title as string}</div>
                <div className="truncate text-xs text-neutral-500">
                  {(b.author as string) ?? '—'}
                </div>
                <div className="mt-2 font-semibold text-teal-800">
                  {formatBaht(Number(b.sell_price))}
                </div>
                <div className="mt-1 text-xs">
                  {isPreorder ? (
                    <span className="text-amber-700">
                      เปิดจอง · ของเข้า {formatDate(b.preorder_release_date as string)}
                    </span>
                  ) : available > 0 ? (
                    <span className="text-teal-700">พร้อมส่ง (เหลือ {available} เล่ม)</span>
                  ) : (
                    <span className="text-neutral-400">สินค้าหมด</span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {!books?.length && (
        <p className="card text-center text-sm text-neutral-500">ไม่พบหนังสือที่ค้นหา</p>
      )}
    </div>
  )
}
