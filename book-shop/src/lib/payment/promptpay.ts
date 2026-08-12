import generatePayload from 'promptpay-qr'
import QRCode from 'qrcode'

/**
 * สร้าง PromptPay QR เอง ไม่ต้องผ่าน payment gateway (ไม่เสียค่าธรรมเนียม)
 *
 * เทคนิคเศษสตางค์:
 * ถ้าลูกค้าหลายคนสั่งยอดเท่ากันในเวลาไล่เลี่ยกัน จะแยกไม่ออกว่าสลิปไหนของออเดอร์ไหน
 * จึงเติมเศษสตางค์เฉพาะของแต่ละออเดอร์ เช่น 250.00 -> 250.07
 * ทำให้จับคู่ยอดโอนกับออเดอร์ได้แม่นโดยไม่ต้องพึ่ง API ธนาคาร
 */
export function withUniqueSatang(amount: number, orderSeq: number): number {
  const satang = (orderSeq % 99) + 1 // 0.01 - 0.99
  return Math.round(amount * 100 + satang) / 100
}

/** ยอดที่ต้องโอนจริงของออเดอร์ (คำนวณจากเลขที่ออเดอร์ ให้ได้ค่าเดิมเสมอ) */
export function payableAmount(total: number, orderNo: string): number {
  const seq = Number(orderNo.replace(/\D/g, '').slice(-4) || 0)
  return withUniqueSatang(total, seq)
}

export function buildPromptPayPayload(amount: number): string {
  const id = process.env.PROMPTPAY_ID
  if (!id) throw new Error('ไม่พบ PROMPTPAY_ID ใน environment')
  return generatePayload(id, { amount })
}

export async function buildPromptPayQrDataUrl(amount: number): Promise<string> {
  const payload = buildPromptPayPayload(amount)
  return QRCode.toDataURL(payload, { width: 512, margin: 1 })
}
