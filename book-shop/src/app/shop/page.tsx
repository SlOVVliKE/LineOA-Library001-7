import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from './CustomerGate'
import { formatBaht, formatDate } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function ShopHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; sort?: string; mode?: string }>
}) {
  const customer = await getCustomer()
  if (!customer) return <CustomerGate />

  const { q, cat, sort, mode } = await searchParams
  const supabase = await createClient()

  // ปุ่ม "มาใหม่" กับ "เปิดจอง" ใน Rich Menu ยิงมาที่ ?sort=new และ ?mode=preorder
  // ค่าที่ไม่รู้จักให้ตกกลับเป็นค่าปกติ ไม่ต้อง error — ลิงก์เก่าที่ลูกค้าเซฟไว้จะได้ไม่พัง
  const sortByNew = sort === 'new'
  const modeFilter = mode === 'preorder' || mode === 'stock' ? mode : null

  let query = supabase
    .from('books')
    .select('id, sku, title, author, publisher, sell_price, cover_url, stock_mode, preorder_release_date, category_id')
    .eq('is_active', true)
    .limit(60)

  query = sortByNew
    ? query.order('created_at', { ascending: false })
    : query.order('title')

  if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%`)
  if (cat) query = query.eq('category_id', cat)

  // 'backorder' นับเป็นของสั่งจองด้วย เพราะลูกค้ามองว่าเหมือนกัน — จ่ายก่อน รอของทีหลัง
  if (modeFilter === 'preorder') query = query.neq('stock_mode', 'stock')
  if (modeFilter === 'stock') query = query.eq('stock_mode', 'stock')

  const [{ data: books }, { data: stock }, { data: categories }] = await Promise.all([
    query,
    supabase.from('v_public_stock').select('book_id, available_to_sell'),
    supabase.from('categories').select('id, name').order('sort_order'),
  ])

  const stockMap = new Map(
    (stock ?? []).map((s) => [s.book_id as string, Number(s.available_to_sell)])
  )

  /** สร้างลิงก์โดยคงค่ากรองอื่นไว้ กดเปลี่ยนหมวดแล้วต้องไม่หลุดจาก "เปิดจอง" */
  const hrefWith = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams()
    const merged = { q, cat, sort, mode, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v)
    const s = p.toString()
    return s ? `/shop?${s}` : '/shop'
  }

  const chip = (active: boolean) =>
    `badge border ${active ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-neutral-300 text-neutral-600'}`

  const emptyMessage = q
    ? 'ไม่พบหนังสือที่ค้นหา'
    : modeFilter === 'preorder'
      ? 'ตอนนี้ยังไม่มีหนังสือเปิดให้จอง'
      : modeFilter === 'stock'
        ? 'ตอนนี้ยังไม่มีหนังสือพร้อมส่ง'
        : 'ยังไม่มีหนังสือในหมวดนี้'

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        {/* คงค่ากรองไว้ตอนกดค้นหา ไม่งั้นค้นทีเดียวหลุดกลับไปหน้ารวม */}
        {cat && <input type="hidden" name="cat" value={cat} />}
        {sort && <input type="hidden" name="sort" value={sort} />}
        {mode && <input type="hidden" name="mode" value={mode} />}
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="ค้นหาชื่อหนังสือ ผู้แต่ง หรือ ISBN"
          className="input"
        />
        <button className="btn-ghost shrink-0">ค้นหา</button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        <Link href={hrefWith({ sort: null, mode: null })} className={chip(!sortByNew && !modeFilter)}>
          ทั้งหมด
        </Link>
        <Link href={hrefWith({ sort: 'new', mode: null })} className={chip(sortByNew)}>
          มาใหม่
        </Link>
        <Link href={hrefWith({ mode: 'preorder', sort: null })} className={chip(modeFilter === 'preorder')}>
          เปิดจอง
        </Link>
        <Link href={hrefWith({ mode: 'stock', sort: null })} className={chip(modeFilter === 'stock')}>
          พร้อมส่ง
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link href={hrefWith({ cat: null })} className={chip(!cat)}>
          ทุกหมวด
        </Link>
        {(categories ?? []).map((c) => (
          <Link
            key={c.id as string}
            href={hrefWith({ cat: c.id as string })}
            className={chip(cat === c.id)}
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
        <p className="card text-center text-sm text-neutral-500">{emptyMessage}</p>
      )}
    </div>
  )
}
