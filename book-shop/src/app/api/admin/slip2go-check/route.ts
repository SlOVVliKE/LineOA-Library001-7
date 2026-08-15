import { requirePermission } from '@/lib/auth/permissions'
import { checkSlip2GoConnection } from '@/lib/payment/slip2go'

export const dynamic = 'force-dynamic'

/**
 * เช็คว่ากุญแจเชื่อมต่อ Slip2Go ใช้ได้ไหม — เปิด URL นี้ในเบราว์เซอร์ตอนล็อกอินเป็นแอดมิน
 *
 * มีไว้เพื่อไม่ต้องโอนเงินจริงทุกครั้งที่อยากรู้ว่าตั้งค่าถูกหรือยัง
 * ใช้ endpoint ดึงข้อมูลบัญชีของ Slip2Go ซึ่งไม่กินโควตาตรวจสลิป
 *
 * ปิดไว้เฉพาะคนที่มีสิทธิ์ยืนยันการชำระเงิน เพราะผลลัพธ์บอกใบ้สถานะการตั้งค่าระบบ
 */
export async function GET() {
  await requirePermission('payment.verify')

  const result = await checkSlip2GoConnection()

  return Response.json({
    ...result,
    ตั้งค่าแล้ว: {
      SLIP2GO_SECRET: Boolean(process.env.SLIP2GO_SECRET?.trim()),
      PROMPTPAY_ID: Boolean(process.env.PROMPTPAY_ID?.trim()),
      SLIP2GO_ACCOUNT_TYPE: process.env.SLIP2GO_ACCOUNT_TYPE ?? '02001 (ค่าเริ่มต้น)',
      SHOP_ACCOUNT_NAME_TH: Boolean(process.env.SHOP_ACCOUNT_NAME_TH?.trim()),
    },
  })
}
