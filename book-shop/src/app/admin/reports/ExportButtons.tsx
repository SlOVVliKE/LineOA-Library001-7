'use client'

const KINDS = [
  { kind: 'orders', label: 'รายออเดอร์', hint: 'ละเอียดที่สุด ส่งนักบัญชีได้เลย' },
  { kind: 'daily',  label: 'รายวัน',     hint: 'ยอดขายและกำไรต่อวัน แยกช่องทาง' },
  { kind: 'books',  label: 'รายเล่ม',    hint: 'กำไรของหนังสือแต่ละเล่ม' },
]

export function ExportButtons({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-neutral-500">ดาวน์โหลด CSV:</span>
      {KINDS.map((k) => (
        <a
          key={k.kind}
          href={`/admin/reports/export?kind=${k.kind}&from=${from}&to=${to}`}
          title={k.hint}
          className="badge badge-info border px-2.5 py-1"
          style={{ borderColor: 'var(--info)' }}
        >
          {k.label}
        </a>
      ))}
    </div>
  )
}
