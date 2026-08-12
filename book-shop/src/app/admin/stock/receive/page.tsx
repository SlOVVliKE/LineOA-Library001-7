import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { ReceiveForm } from './ReceiveForm'

export const dynamic = 'force-dynamic'

export default async function ReceivePage() {
  await requirePermission('lot.write')
  const supabase = await createClient()
  const { data: books } = await supabase
    .from('books').select('id, sku, title').eq('is_active', true).order('title')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">รับสินค้าเข้าสต็อก</h1>
        <p className="mt-1 text-sm text-neutral-600">
          ทุกครั้งที่รับของเข้าให้บันทึกเป็น &ldquo;ล็อต&rdquo; พร้อมต้นทุนจริง
          ระบบจะตัดสต็อกแบบ FIFO ตามลำดับที่รับเข้า และคำนวณกำไรจากต้นทุนของล็อตที่ถูกตัดจริง
        </p>
      </div>
      <ReceiveForm books={(books ?? []) as { id: string; sku: string; title: string }[]} />
    </div>
  )
}
