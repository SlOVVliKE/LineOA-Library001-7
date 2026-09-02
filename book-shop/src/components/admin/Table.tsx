/**
 * โครงตารางที่ซ้ำเป๊ะกันอยู่แล้วใน 8 หน้าหลังบ้าน — ดึงออกมาไว้ที่เดียว
 * เพื่อไม่ต้องแก้ซ้ำทีละไฟล์ตอนรอบ 4 (ดู plan.md ข้อ 1.5)
 *
 * ตั้งใจให้เหมือนโครงเดิมทุกประการ (ไม่เปลี่ยนสี/ระยะห่าง) — งานนี้คือแยกโค้ดซ้ำ
 * ออกมาเฉยๆ ส่วนการเปลี่ยนไปใช้ token ชุดหลังบ้าน (.a-table/.a-row) เป็นงานรอบ 4
 */

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full">{children}</table>
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
  return <tr className="border-t border-neutral-100 hover:bg-neutral-50">{children}</tr>
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
