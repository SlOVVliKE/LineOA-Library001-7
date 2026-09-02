import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { NewCategoryForm } from './NewCategoryForm'
import { CategoryRow } from './CategoryRow'
import { EmptyState } from '@/components/admin/EmptyState'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  await requirePermission('book.write')
  const supabase = await createClient()

  const [{ data: categories }, { data: books }] = await Promise.all([
    supabase.from('categories').select('id, name, slug, sort_order').order('sort_order'),
    // ดึงเฉพาะ category_id มานับฝั่งแอป เพราะ PostgREST นับแบบ group by ให้ไม่ได้
    // จำนวนหมวดกับหนังสือของร้านหนังสือทั่วไปอยู่ในหลักพัน ยังไม่คุ้มที่จะทำ view แยก
    supabase.from('books').select('category_id'),
  ])

  const countByCategory = new Map<string, number>()
  for (const b of books ?? []) {
    const cid = b.category_id as string | null
    if (cid) countByCategory.set(cid, (countByCategory.get(cid) ?? 0) + 1)
  }

  const uncategorised = (books ?? []).filter((b) => !b.category_id).length
  const rows = categories ?? []
  const nextSortOrder =
    rows.length > 0 ? Math.max(...rows.map((c) => Number(c.sort_order))) + 1 : 1

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">หมวดหมู่หนังสือ</h1>
        <p className="mt-1 text-sm text-neutral-600">
          ใช้เป็นปุ่มกรองที่หน้าร้าน และต้องมีอย่างน้อย 1 หมวดก่อนถึงจะเพิ่มหนังสือได้
        </p>
      </div>

      <NewCategoryForm nextSortOrder={nextSortOrder} />

      {rows.length === 0 ? (
        <EmptyState>ยังไม่มีหมวดหมู่ — เพิ่มหมวดแรกด้านบนได้เลย</EmptyState>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">ลำดับ</th>
                <th className="px-3 py-2 font-medium">ชื่อหมวด</th>
                <th className="px-3 py-2 font-medium">รหัส (slug)</th>
                <th className="px-3 py-2 text-right font-medium">หนังสือ</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <CategoryRow
                  key={c.id as string}
                  id={c.id as string}
                  name={c.name as string}
                  slug={c.slug as string}
                  sortOrder={Number(c.sort_order)}
                  bookCount={countByCategory.get(c.id as string) ?? 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uncategorised > 0 && (
        <p className="card text-sm text-amber-800">
          มีหนังสือ {uncategorised} เล่มที่ยังไม่ได้อยู่หมวดไหน — ลูกค้าจะเจอได้จากการค้นหาเท่านั้น
          กดปุ่มหมวดที่หน้าร้านแล้วจะไม่เห็นเล่มพวกนี้
        </p>
      )}
    </div>
  )
}
