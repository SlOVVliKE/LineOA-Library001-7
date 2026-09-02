import { formatBaht, formatDate } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'

/** แท็บ "ล็อตและต้นทุน" — ตอบคำถาม "ล็อตไหนเข้ามาเมื่อไหร่ ต้นทุนเท่าไหร่ FIFO จะตัดตัวไหนก่อน" */
export async function LotsTab({ from, to }: { from: string; to: string }) {
  const supabase = await createClient()
  const { data: lots } = await supabase
    .from('purchase_lots')
    .select('id, lot_no, supplier, received_at, created_at, qty_received, qty_remaining, unit_cost, shipping_cost, landed_unit_cost, books(sku, title)')
    .gte('received_at', from)
    .lte('received_at', to)
    .order('received_at', { ascending: false })
    .limit(50)

  return (
    <section className="card overflow-x-auto p-0">
      <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">ล็อตที่รับเข้าในช่วงนี้</h2>
      <table className="w-full">
        <thead className="bg-neutral-50">
          <tr>
            <th className="th">ล็อต</th>
            <th className="th">หนังสือ</th>
            <th className="th">วันที่ของมาถึง</th>
            <th className="th">วันที่บันทึกเข้าระบบ</th>
            <th className="th">ซัพพลายเออร์</th>
            <th className="th text-right">รับเข้า</th>
            <th className="th text-right">เหลือ</th>
            <th className="th text-right">ต้นทุนจริง/เล่ม</th>
          </tr>
        </thead>
        <tbody>
          {(lots ?? []).map((l) => {
            const book = l.books as unknown as { sku: string; title: string } | null
            const received = new Date(l.received_at as string).toDateString()
            const created = new Date(l.created_at as string).toDateString()
            return (
              <tr key={l.id as string} className="border-t border-neutral-100">
                <td className="td font-mono text-xs">{(l.lot_no as string) ?? '—'}</td>
                <td className="td">{book?.title ?? '—'}</td>
                <td className="td">{formatDate(l.received_at as string)}</td>
                <td className="td text-neutral-500">
                  {formatDate(l.created_at as string)}
                  {received !== created && (
                    <span className="ml-1 text-xs text-amber-600">(บันทึกย้อนหลัง)</span>
                  )}
                </td>
                <td className="td text-neutral-600">{(l.supplier as string) ?? '—'}</td>
                <td className="td text-right">{Number(l.qty_received)}</td>
                <td className="td text-right font-medium">{Number(l.qty_remaining)}</td>
                <td className="td text-right font-medium">
                  {formatBaht(Number(l.landed_unit_cost))}
                </td>
              </tr>
            )
          })}
          {!lots?.length && (
            <tr>
              <td className="td py-6 text-center text-neutral-500" colSpan={8}>
                ไม่มีการรับสินค้าเข้าในช่วงวันที่เลือก
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
        &ldquo;วันที่ของมาถึง&rdquo; คือวันที่ระบุตอนกรอกฟอร์ม ใช้จัดลำดับ FIFO ·
        &ldquo;วันที่บันทึกเข้าระบบ&rdquo; คือเวลาจริงที่กดบันทึก — ถ้าสองค่าไม่ตรงกันแปลว่าบันทึกย้อนหลัง
      </p>
    </section>
  )
}
