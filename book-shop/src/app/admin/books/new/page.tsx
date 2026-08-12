import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { BookForm } from '../BookForm'
import { createBook } from '../actions'

export const dynamic = 'force-dynamic'

export default async function NewBookPage() {
  await requirePermission('book.write')
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories').select('id, name').order('sort_order')

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">เพิ่มหนังสือ</h1>
      <BookForm action={createBook} categories={(categories ?? []) as { id: string; name: string }[]} />
    </div>
  )
}
