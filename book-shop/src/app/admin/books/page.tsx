import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { formatBaht, formatNumber } from '@/lib/money'
import { Table, TableHead, TableRow, EmptyRow } from '@/components/admin/Table'

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

      <form className="a-card sticky top-0 z-10 flex gap-2" style={{ background: 'var(--paper)' }}>
        <input name="q" defaultValue={q ?? ''} placeholder="ค้นหาชื่อหนังสือ"
          className="input max-w-xs" />
        <button className="btn-ghost">ค้นหา</button>
      </form>

      <Table>
        <TableHead>
          <th className="th">SKU</th>
          <th className="th">ชื่อหนังสือ</th>
          <th className="th">ผู้แต่ง</th>
          <th className="th text-right">ราคาขาย</th>
          <th className="th text-right">คงเหลือ</th>
          <th className="th text-right">ขายได้</th>
          <th className="th">สถานะ</th>
        </TableHead>
        <tbody>
          {(books ?? []).map((b) => {
            const s = stockMap.get(b.id as string)
            return (
              <TableRow key={b.id as string}>
                <td className="td font-mono text-xs">{b.sku}</td>
                <td className="td">
                  <Link href={`/admin/books/${b.id}`} className="a-link">
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
                    <span className="badge badge-ok">เปิดขาย</span>
                  ) : (
                    <span className="badge badge-quiet">ปิด</span>
                  )}
                </td>
              </TableRow>
            )
          })}
          {!books?.length && <EmptyRow colSpan={7}>ยังไม่มีข้อมูลหนังสือ</EmptyRow>}
        </tbody>
      </Table>

      <p className="text-xs text-neutral-500">
        &ldquo;คงเหลือ&rdquo; คือจำนวนจริงในคลัง ส่วน &ldquo;ขายได้&rdquo; หักของที่ลูกค้าจองไว้และกันชนสำหรับขายหลายช่องทางแล้ว
      </p>
    </div>
  )
}
