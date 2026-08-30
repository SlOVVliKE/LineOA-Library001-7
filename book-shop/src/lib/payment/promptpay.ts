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

/**
 * สร้าง QR เป็น SVG ไม่ใช่ PNG
 *
 * เหตุผลข้อแรก — ของเดิมใช้ QRCode.toDataURL() ซึ่งวาดลงบน <canvas>
 * บน Cloudflare Workers ไม่มี canvas ฟังก์ชันนี้จะโยน
 * "You need to specify a canvas element" ทันที
 * และมันพังตอน runtime ไม่ใช่ตอน build แปลว่าจะไม่มีใครรู้จนกว่า
 * ลูกค้าจะกดเข้าหน้าจ่ายเงินแล้วเจอหน้าเปล่า
 *
 * เหตุผลข้อสอง — SVG ดีกว่า PNG สำหรับ QR อยู่แล้วถึงไม่ย้ายโฮสต์
 *   PNG data URL: ~15,000 bytes  ซูมแล้วเบลอ
 *   SVG:           ~1,950 bytes  คมทุกระดับ
 * QR ที่เบลอ = แอปธนาคารสแกนยากขึ้น ซึ่งเป็นสิ่งสุดท้ายที่เราอยากให้เกิด
 *
 * ไม่ส่ง width เข้าไป เพื่อให้ได้ viewBox ล้วนๆ แล้วค่อยกำหนดขนาดด้วย CSS
 * (ไลบรารีใส่ shape-rendering="crispEdges" มาให้แล้ว ซึ่งถูกต้องสำหรับ QR)
 */
export async function buildPromptPayQrSvg(amount: number): Promise<string> {
  const payload = buildPromptPayPayload(amount)
  return QRCode.toString(payload, { type: 'svg', margin: 1 })
}
