import { createClient } from '@/lib/supabase/server'
import { DailyBars, type DailyRow } from '@/components/DailyBars'
import { formatBaht, formatNumber, formatDate } from '@/lib/money'

/** แท็บ "ความเคลื่อนไหว" — ตอบคำถาม "เดือนนี้ขาย/รับเข้าเท่าไหร่ · กราฟรายวัน" */
export async function MovementTab({ from, to, showCost }: { from: string; to: string; showCost: boolean }) {
  const supabase = await createClient()
  const { data: daily } = await supabase
    .from('v_stock_movement_daily_total')
    .select('*')
    .gte('day', from)
    .lte('day', to)
    .order('day')

  // เรื่องเครื่องหมายบวกลบ วิวส่งค่ามาไม่เหมือนกันในแต่ละคอลัมน์:
  //   qty_sold / qty_damaged  ส่งมาเป็นจำนวนเต็มบวก (ขาย 1 เล่ม = 1)
  //   qty_adjusted            ส่งมาพร้อมเครื่องหมายจริง (ปรับลด 1 เล่ม = -1)
  // ถ้าเอามาบวกกันตรงๆ ของเสียจะกลายเป็นของเข้า แล้วยอดสุทธิจะเกินความจริง
  // qty_returned ก็ต้องนับด้วย ไม่งั้นการรับคืนจากลูกค้าจะหายไปจากตาราง
  const dailyRows: DailyRow[] = (daily ?? []).map((d) => ({
    day: d.day as string,
    received: Number(d.qty_received ?? 0),
    sold: Number(d.qty_sold ?? 0),
    other:
      Number(d.qty_adjusted ?? 0) -
      Number(d.qty_damaged ?? 0) +
      Number(d.qty_returned ?? 0),
    // ยอดสุทธิใช้ค่าที่ฐานข้อมูลรวมมาให้ ไม่คำนวณซ้ำเอง จะได้ไม่มีทางเพี้ยนจากกัน
    net: Number(d.qty_net ?? 0),
    cogs: Number(d.cogs_out ?? 0),
  }))

  const movedDays = dailyRows.filter((d) => d.sold > 0 || d.received > 0)

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="font-medium">ความเคลื่อนไหวรายวัน</h2>
        <DailyBars rows={dailyRows} />
      </section>

      {movedDays.length > 0 && (
        <section className="card overflow-x-auto p-0">
          <h2 className="border-b border-neutral-100 px-5 py-3 font-medium">
            สรุปรายวัน (เฉพาะวันที่มีความเคลื่อนไหว)
          </h2>
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="th">วันที่</th>
                <th className="th text-right">รับเข้า</th>
                <th className="th text-right">ขายออก</th>
                <th className="th text-right">ปรับ/เสียหาย</th>
                <th className="th text-right">สุทธิ</th>
                {showCost && <th className="th text-right">ต้นทุนที่ขายไป</th>}
              </tr>
            </thead>
            <tbody>
              {[...movedDays].reverse().map((d) => (
                <tr key={d.day} className="border-t border-neutral-100">
                  <td className="td">{formatDate(d.day)}</td>
                  <td className="td text-right text-sky-700">
                    {d.received > 0 ? `+${formatNumber(d.received)}` : '—'}
                  </td>
                  <td className="td text-right font-medium">
                    {d.sold > 0 ? formatNumber(d.sold) : '—'}
                  </td>
                  <td className="td text-right text-neutral-500">
                    {d.other !== 0 ? formatNumber(d.other) : '—'}
                  </td>
                  <td className="td text-right">{formatNumber(d.net)}</td>
                  {/* ตัดสินด้วยจำนวนที่ขาย ไม่ใช่ตัวเลขต้นทุน เพราะต้นทุนรวม 0 บาท
                      (ของแถม/ของตัวอย่าง) เป็นค่าที่ถูกต้อง ขีดกลางไว้ใช้กับวันที่ไม่มีการขาย */}
                  {showCost && (
                    <td className="td text-right">
                      {d.sold > 0 ? formatBaht(d.cogs) : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
