/**
 * ระบบนี้ไม่คิด VAT — ราคาที่แสดงคือราคาที่ลูกค้าจ่ายจริง
 * เก็บเงินเป็น number ที่ปัดเป็นทศนิยม 2 ตำแหน่งเสมอ
 */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

const baht = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
})

export function formatBaht(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return baht.format(n)
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('th-TH').format(n)
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
  }).format(new Date(d))
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(d))
}

// ---------- กติกาค่าส่ง ----------
export interface ShippingRule {
  flatFee: number
  freeThreshold: number
}

export const DEFAULT_SHIPPING_RULE: ShippingRule = {
  flatFee: 40,
  freeThreshold: 500,
}

/** คิดค่าส่งจากยอดสินค้าหลังหักส่วนลด */
export function calcShippingFee(
  goodsTotalAfterDiscount: number,
  rule: ShippingRule = DEFAULT_SHIPPING_RULE
): number {
  return goodsTotalAfterDiscount >= rule.freeThreshold ? 0 : rule.flatFee
}

// ---------- กำไร ----------
export interface ProfitInput {
  subtotal: number
  discount?: number
  shippingFee?: number
  cogsTotal?: number
  shippingActualCost?: number
  channelFee?: number
}

/** ต้องตรงกับ generated column orders.gross_profit ใน migration 0005 */
export function calcGrossProfit(i: ProfitInput): number {
  return round2(
    i.subtotal -
      (i.discount ?? 0) -
      (i.cogsTotal ?? 0) +
      (i.shippingFee ?? 0) -
      (i.shippingActualCost ?? 0) -
      (i.channelFee ?? 0)
  )
}

/** ต้นทุนจริงต่อเล่ม = ราคาซื้อ + ค่าขนส่งขาเข้าเฉลี่ย */
export function landedUnitCost(
  unitCost: number,
  shippingCost: number,
  qty: number
): number {
  if (qty <= 0) return unitCost
  return round2(unitCost + shippingCost / qty)
}
