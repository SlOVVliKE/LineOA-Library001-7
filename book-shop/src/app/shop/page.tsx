import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from './CustomerGate'
import { ShopFilters } from './ShopFilters'
import { formatBaht, formatDate } from '@/lib/money'

export const dynamic = 'force-dynamic'

/** ค่าจาก URL อาจมาเป็นค่าเดียวหรือหลายค่า — ทำให้เป็น array เสมอ */
function toArray(v: string | string[] | undefined): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

export default async function ShopHome({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    cat?: string | string[]
    sort?: string
    mode?: string | string[]
  }>
}) {
  const customer = await getCustomer()
  if (!customer) return <CustomerGate />

  const sp = await searchParams
  const q = sp.q?.trim()
  const cats = toArray(sp.cat)
  const modes = toArray(sp.mode).filter((m) => m === 'stock' || m === 'preorder')
  const sortByNew = sp.sort === 'new'

  const supabase = await createClient()

  // ใช้ v_shop_books แทนการยิง books + v_public_stock แยกกัน
  // ได้ทั้งจำนวนคงเหลือและวันที่ของเข้าล่าสุดในรอบเดียว (ดู migration 0019)
  let query = supabase.from('v_shop_books').select('*').limit(60)

  query = sortByNew
    ? query.order('last_arrival_at', { ascending: false })
    : query.order('title')

  if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%`)
  if (cats.length > 0) query = query.in('category_id', cats)

  // ติ๊กทั้งสองอันหรือไม่ติ๊กเลย = ไม่กรอง (ผลลัพธ์เหมือนกัน จึงไม่ต้องเสียรอบ query)
  // 'backorder' นับเป็นของสั่งจองด้วย เพราะลูกค้ามองว่าเหมือนกัน — จ่ายก่อน รอของทีหลัง
  if (modes.length === 1) {
    query = modes[0] === 'stock'
      ? query.eq('stock_mode', 'stock')
      : query.neq('stock_mode', 'stock')
  }

  const [{ data: books }, { data: categories }] = await Promise.all([
    query,
    supabase.from('categories').select('id, name').order('sort_order'),
  ])

  const emptyMessage = q
    ? `ไม่พบหนังสือที่ตรงกับ "${q}"`
    : modes.length === 1 && modes[0] === 'preorder'
      ? 'ตอนนี้ยังไม่มีหนังสือเปิดให้จอง'
      : modes.length === 1 && modes[0] === 'stock'
        ? 'ตอนนี้ยังไม่มีหนังสือพร้อมส่ง'
        : 'ยังไม่มีหนังสือที่ตรงกับตัวกรอง'

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        {/* คงตัวกรองไว้ตอนกดค้นหา ไม่งั้นค้นทีเดียวหลุดกลับไปหน้ารวม */}
        {cats.map((c) => (
          <input key={c} type="hidden" name="cat" value={c} />
        ))}
        {modes.map((m) => (
          <input key={m} type="hidden" name="mode" value={m} />
        ))}
        {sortByNew && <input type="hidden" name="sort" value="new" />}
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="ค้นหาชื่อหนังสือ ผู้แต่ง หรือ ISBN"
          className="input"
        />
        <button className="btn-ghost shrink-0">ค้นหา</button>
      </form>

      <Suspense fallback={<div className="card text-sm text-neutral-400">กำลังโหลดตัวกรอง...</div>}>
        <ShopFilters categories={(categories ?? []) as { id: string; name: string }[]} />
      </Suspense>

      <div className="grid gap-3 sm:grid-cols-2">
        {(books ?? []).map((b) => {
          const available = Number(b.available_to_sell ?? 0)
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
