import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { AdjustForm } from './AdjustForm'

export const dynamic = 'force-dynamic'

export default async function AdjustPage() {
  await requirePermission('lot.write')
  const supabase = await createClient()
  const { data: books } = await supabase
    .from('v_stock_summary').select('book_id, sku, title, on_hand').order('title')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">ปรับสต็อก</h1>
        <p className="mt-1 text-sm text-neutral-600">
          ใช้เมื่อตรวจนับแล้วไม่ตรง มีของเสีย หรือของหาย
          ทุกครั้งต้องระบุเหตุผล ระบบจะบันทึกไว้ในประวัติพร้อมชื่อผู้ทำรายการ
        </p>
      </div>
      <AdjustForm books={(books ?? []) as { book_id: string; sku: string; title: string; on_hand: number }[]} />
    </div>
  )
}
