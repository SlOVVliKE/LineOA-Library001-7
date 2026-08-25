import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCustomer } from '@/lib/customer/session'
import { CustomerGate } from './CustomerGate'
import { ShopFilters } from './ShopFilters'
import { BookCard, type BookCardData } from '@/components/BookCard'

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

  const hasFilter = Boolean(q) || cats.length > 0 || modes.length === 1

  return (
    <div className="space-y-3">
      {/* ช่องค้นหา — ปุ่มอยู่ในกรอบเดียวกับช่องกรอก
          บนมือถือปุ่มแยกจะกินความกว้างจนพิมพ์ได้ไม่กี่ตัวอักษร */}
      <form className="relative" role="search">
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
          className="input pr-[84px]"
          enterKeyHint="search"
        />
        {/* ปุ่มสูง 40px ในช่องกรอกที่สูง 48px — เตี้ยกว่าเกณฑ์ 44px เล็กน้อย
            แต่ยอมรับได้เพราะเป็นปุ่มในกรอบ ไม่มีปุ่มอื่นอยู่ติดให้กดพลาด
            และกด Enter บนแป้นพิมพ์ก็ค้นได้เหมือนกัน */}
        <button
          className="absolute right-1.5 top-1/2 flex h-10 -translate-y-1/2 items-center
                     rounded-lg px-3.5 text-[14px]"
          style={{ background: 'var(--paper-sunken)', color: 'var(--ink)' }}
        >
          ค้นหา
        </button>
      </form>

      <Suspense
        fallback={
          <div className="card t-meta">กำลังโหลดตัวกรอง...</div>
        }
      >
        <ShopFilters categories={(categories ?? []) as { id: string; name: string }[]} />
      </Suspense>

      {books?.length ? (
        <>
          <p className="t-micro px-1">พบ {books.length} เล่ม</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {books.map((b) => (
              <BookCard key={b.id as string} book={b as unknown as BookCardData} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState query={q} hasFilter={hasFilter} />
      )}
    </div>
  )
}

/**
 * หน้าจอตอนไม่เจอของ
 *
 * ของเดิมขึ้นข้อความบรรทัดเดียวแล้วจบ ลูกค้าที่พิมพ์ผิดจะไม่รู้ว่าต้องทำอะไรต่อ
 * ตรงนี้เลยบอกทางออกให้เสมอ — ถ้ามีตัวกรองอยู่ก็เสนอให้ล้าง
 */
function EmptyState({ query, hasFilter }: { query?: string; hasFilter: boolean }) {
  return (
    <div className="card py-10 text-center">
      <p className="t-body">
        {query ? `ไม่พบหนังสือที่ตรงกับ "${query}"` : 'ยังไม่มีหนังสือที่ตรงกับตัวกรอง'}
      </p>
      <p className="t-meta mt-1">
        {query
          ? 'ลองพิมพ์คำสั้นลง หรือค้นด้วยชื่อผู้แต่งแทน'
          : 'ลองเอาตัวกรองบางอันออกดู'}
      </p>
      {hasFilter && (
        <Link href="/shop" className="btn-ghost mt-4 inline-flex">
          ดูหนังสือทั้งหมด
        </Link>
      )}
    </div>
  )
}
