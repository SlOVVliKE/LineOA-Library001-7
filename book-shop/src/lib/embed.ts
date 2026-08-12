/**
 * PostgREST คืนค่า relation ที่ฝังมาเป็น array เสมอ แม้จะเป็นความสัมพันธ์แบบ many-to-one
 * ตัวช่วยนี้ดึงตัวเดียวออกมาให้ โดยรองรับทั้งกรณีที่ได้ array และได้ object ตรงๆ
 */
export function one<T>(value: unknown): T | null {
  if (value == null) return null
  if (Array.isArray(value)) return (value[0] as T) ?? null
  return value as T
}

export function many<T>(value: unknown): T[] {
  if (value == null) return []
  return Array.isArray(value) ? (value as T[]) : [value as T]
}
