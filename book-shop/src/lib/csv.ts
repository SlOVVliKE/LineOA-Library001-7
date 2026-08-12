/**
 * สร้างไฟล์ CSV ที่เปิดใน Excel ภาษาไทยแล้วไม่เป็นตัวยึกยือ
 *
 * Excel บน Windows เดาว่าไฟล์เป็น ANSI ถ้าไม่มี BOM
 * ต้องใส่ ﻿ นำหน้าเสมอ ไม่งั้นภาษาไทยจะอ่านไม่ออก
 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(escape).join(',')).join('\r\n')
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** ช่วงวันที่เริ่มต้น: 30 วันล่าสุด (คืนค่าเป็น YYYY-MM-DD) */
export function defaultDateRange(days = 30): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}
