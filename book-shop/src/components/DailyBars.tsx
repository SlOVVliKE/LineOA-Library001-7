import { formatBaht, formatDate, formatNumber } from '@/lib/money'

export interface DailyRow {
  day: string
  received: number
  sold: number
  other: number
  cogs: number
}

/**
 * กราฟแท่งอย่างง่ายด้วย CSS ล้วน — ไม่ต้องพึ่งไลบรารีกราฟ
 * จุดประสงค์คือ "เห็นรูปทรง" ว่าวันไหนพุ่งวันไหนตก ไม่ใช่กราฟเชิงวิเคราะห์ลึก
 */
export function DailyBars({ rows }: { rows: DailyRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="card text-center text-sm text-neutral-500">
        ไม่มีความเคลื่อนไหวในช่วงวันที่เลือก
      </p>
    )
  }

  const max = Math.max(...rows.map((r) => Math.max(r.received, r.sold)), 1)
  const totalSold = rows.reduce((s, r) => s + r.sold, 0)
  const busiest = rows.reduce((a, b) => (b.sold > a.sold ? b : a), rows[0])
  const avg = totalSold / rows.length

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <div className="text-xs text-neutral-500">ขายออกรวม</div>
          <div className="text-lg font-semibold">{formatNumber(totalSold)} เล่ม</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">เฉลี่ยต่อวัน</div>
          <div className="text-lg font-semibold">{avg.toFixed(1)} เล่ม</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">วันที่ขายดีที่สุด</div>
          <div className="text-lg font-semibold">
            {formatDate(busiest.day)} · {formatNumber(busiest.sold)} เล่ม
          </div>
        </div>
      </div>

      <div className="flex items-end gap-[3px] overflow-x-auto pb-1" style={{ height: 140 }}>
        {rows.map((r) => {
          const soldH = (r.sold / max) * 100
          const recvH = (r.received / max) * 100
          const isPeak = r.sold === busiest.sold && r.sold > 0
          return (
            <div
              key={r.day}
              className="group relative flex min-w-[10px] flex-1 flex-col justify-end gap-[2px]"
              title={`${formatDate(r.day)}\nขายออก ${r.sold} เล่ม\nรับเข้า ${r.received} เล่ม\nต้นทุนที่ขาย ${formatBaht(r.cogs)}`}
            >
              {r.received > 0 && (
                <div
                  className="w-full rounded-t bg-sky-200"
                  style={{ height: `${Math.max(recvH, 2)}%` }}
                />
              )}
              <div
                className={`w-full rounded-t ${isPeak ? 'bg-teal-600' : 'bg-teal-400'}`}
                style={{ height: `${Math.max(soldH, r.sold > 0 ? 3 : 0)}%` }}
              />
            </div>
          )
        })}
      </div>

      <div className="flex gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-teal-400" /> ขายออก
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-sky-200" /> รับเข้า
        </span>
        <span className="ml-auto">เอาเมาส์ชี้ที่แท่งเพื่อดูตัวเลขของวันนั้น</span>
      </div>
    </div>
  )
}
