/**
 * ทดสอบตรรกะเงิน: ค่าส่ง · ต้นทุนจริงต่อเล่ม · กำไรขั้นต้น
 * รัน: npm test
 *
 * ตัวเลขในไฟล์นี้ต้องตรงกับ:
 *  - generated column `orders.gross_profit` ใน migration 0005
 *  - ฟังก์ชัน fn_consume_stock_fifo ใน migration 0007
 */
import { calcShippingFee, calcGrossProfit, landedUnitCost, round2 } from '../src/lib/money'

let fail = 0
function eq(name: string, got: number, want: number) {
  const ok = Math.abs(got - want) < 0.005
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${got}, want ${want}`)
  if (!ok) fail++
}

// ---------- ค่าส่ง: เหมา 40 ฟรีเมื่อครบ 500 ----------
eq('ยอด 499 -> เก็บค่าส่ง 40', calcShippingFee(499), 40)
eq('ยอด 500 -> ส่งฟรี', calcShippingFee(500), 0)
eq('ยอด 750 -> ส่งฟรี', calcShippingFee(750), 0)

// ---------- ต้นทุนจริงต่อเล่ม = ราคาซื้อ + ค่าขนส่งขาเข้าเฉลี่ย ----------
eq('ล็อต A: 20 เล่ม @120 + ค่าส่ง 200', landedUnitCost(120, 200, 20), 130)
eq('ล็อต B: 30 เล่ม @115 + ค่าส่ง 150', landedUnitCost(115, 150, 30), 120)

// ---------- FIFO: ขาย 25 เล่ม -> 20 จากล็อต A + 5 จากล็อต B ----------
const cogs25 = 20 * 130 + 5 * 120
eq('COGS ของ 25 เล่ม', cogs25, 3200)
eq('กำไรขั้นต้น (ขาย 25 @250 ส่งฟรี)',
   calcGrossProfit({ subtotal: 6250, cogsTotal: cogs25 }), 3050)

// ---------- ค่าส่งจริงเกินที่เก็บ -> กำไรต้องหดตามจริง ----------
eq('เก็บค่าส่ง 40 แต่จ่ายขนส่งจริง 45',
   calcGrossProfit({ subtotal: 490, shippingFee: 40, shippingActualCost: 45, cogsTotal: 260 }),
   225)

// ---------- ขายผ่าน marketplace: ค่าธรรมเนียมกินกำไร ----------
eq('ออเดอร์เดียวกันผ่าน Shopee (ค่าธรรมเนียม 8%)',
   calcGrossProfit({
     subtotal: 490, shippingFee: 40, shippingActualCost: 45,
     cogsTotal: 260, channelFee: round2(530 * 0.08),
   }),
   182.6)

console.log(fail === 0 ? '\nทั้งหมดผ่าน' : `\nไม่ผ่าน ${fail} ข้อ`)
process.exit(fail === 0 ? 0 : 1)
