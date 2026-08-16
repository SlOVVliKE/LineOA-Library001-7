import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { BookForm } from '../../BookForm'
import { updateBook } from '../../actions'

export const dynamic = 'force-dynamic'

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('book.write')
  const { id } = await params
  const supabase = await createClient()

  const [{ data: book }, { data: categories }] = await Promise.all([
    supabase.from('books').select('*').eq('id', id).maybeSingle(),
    supabase.from('categories').select('id, name').order('sort_order'),
  ])

  if (!book) notFound()

  // ผูก id ไว้กับ action ตั้งแต่ฝั่งเซิร์ฟเวอร์ ฟอร์มจึงไม่ต้องส่ง id มาเอง
  // และไม่มีทางถูกแก้จากเบราว์เซอร์ให้ไปเขียนทับหนังสือเล่มอื่น
  const action = updateBook.bind(null, id as string)

  return (
    <div className="space-y-4">
      <Link href={`/admin/books/${id}`} className="text-sm text-teal-700">
        ← กลับไปหน้าหนังสือ
      </Link>
      <h1 className="text-xl font-semibold">แก้ไข {book.title as string}</h1>
      <BookForm
        action={action}
        categories={(categories ?? []) as { id: string; name: string }[]}
        defaults={book as Record<string, unknown>}
      />
    </div>
  )
}
