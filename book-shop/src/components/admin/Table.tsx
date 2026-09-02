/**
 * โครงตารางที่ซ้ำเป๊ะกันอยู่แล้วในหลายหน้าหลังบ้าน — ดึงออกมาไว้ที่เดียว
 * เพื่อไม่ต้องแก้ซ้ำทีละไฟล์ (ดู plan.md ข้อ 1.5) ใช้ token ความหนาแน่นของ
 * หลังบ้าน (`.a-table`/`.a-row`) ตามที่ตั้งใจไว้ตั้งแต่รอบ 1
 */

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="a-card overflow-x-auto p-0">
      <table className="a-table">{children}</table>
    </div>
  )
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-neutral-50">
      <tr>{children}</tr>
    </thead>
  )
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return <tr className="a-row">{children}</tr>
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td className="td py-8 text-center text-neutral-500" colSpan={colSpan}>
        {children}
      </td>
    </tr>
  )
}
