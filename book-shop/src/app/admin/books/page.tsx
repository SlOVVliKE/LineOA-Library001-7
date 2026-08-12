import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { formatBaht, formatNumber } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requirePermission('book.write')
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('books')
    .select('id, sku, title, author, publisher, sell_price, stock_mode, is_active')
    .order('created_at', { ascending: false })
    .limit(100)

  if (q) query = query.ilike('title', `%${q}%`)

  const [{ data: books }, { data: stock }] = await Promise.all([
    query,
    supabase.from('v_stock_summary').select('book_id, on_hand, available_to_sell'),
  ])

  const stockMap = new Map(
    (stock ?? []).map((s) => [s.book_id as string, s])
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">หนังสือ</h1>
        <Link href="/admin/books/new" className="btn-primary">เพิ่มหนังสือ</Link>
      </div>

      <form className="flex gap-2">
        <input name="q" defaultValue={q ?? ''} placeholder="ค้นหาชื่อหนังสือ"
          className="input max-w-xs" />
        <button className="btn-ghost">ค้นหา</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              <th className="th">SKU</th>
              <th className="th">ชื่อหนังสือ</th>
              <th className="th">ผู้แต่ง</th>
              <th className="th text-right">ราคาขาย</th>
              <th className="th text-right">คงเหลือ</th>
              <th className="th text-right">ขายได้</th>
              <th className="th">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {(books ?? []).map((b) => {
              const s = stockMap.get(b.id as string)
              return (
                <tr key={b.id as string} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="td font-mono text-xs">{b.sku}</td>
                  <td className="td">
                    <Link href={`/admin/books/${b.id}`} className="text-teal-700 hover:underline">
                      {b.title}
                    </Link>
                  </td>
                  <td className="td text-neutral-500">{b.author ?? '—'}</td>
                  <td className="td text-right">{formatBaht(Number(b.sell_price))}</td>
                  <td className="td text-right">{formatNumber(Number(s?.on_hand ?? 0))}</td>
                  <td className="td text-right text-neutral-500">
                    {formatNumber(Number(s?.available_to_sell ?? 0))}
                  </td>
                  <td className="td">
                    {b.is_active ? (
                      <span className="badge bg-teal-50 text-teal-700">เปิดขาย</span>
                    ) : (
                      <span className="badge bg-neutral-100 text-neutral-500">ปิด</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {!books?.length && (
              <tr><td className="td py-8 text-center text-neutral-500" colSpan={7}>
                ยังไม่มีข้อมูลหนังสือ
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500">
        &ldquo;คงเหลือ&rdquo; คือจำนวนจริงในคลัง ส่วน &ldquo;ขายได้&rdquo; หักของที่ลูกค้าจองไว้และกันชนสำหรับขายหลายช่องทางแล้ว
      </p>
    </div>
  )
}
