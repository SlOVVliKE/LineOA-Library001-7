/**
 * สีป้ายสถานะออเดอร์ "เฉพาะหลังบ้าน" — แยกจาก src/lib/orderStatus.ts โดยตั้งใจ
 * เพราะไฟล์นั้น (ORDER_STATUS_STYLE) ใช้ร่วมกับหน้าร้าน /shop/orders
 * ถ้าแก้สีตรงนั้นให้เป็น token จะผิดกฎ "ไม่แตะหน้าร้าน" ของแผนรื้อ UX หลังบ้าน
 * (ดู plan.md ข้อ 4 ในตารางข้อตกลง) — label ยังใช้ ORDER_STATUS_LABEL เดิมได้ปกติ
 *
 * รวบสีดิบ 5 กลุ่มของเดิมเหลือ 3 โทนความหมาย (ok/warn/quiet) + โทนกลาง "กำลัง
 * ดำเนินการ" อีก 1 โทน (badge-info) แทนที่จะคิดสีใหม่ทีละสถานะ — ตัวหนังสือของ
 * ป้ายบอกสถานะเป๊ะอยู่แล้ว สีจึงมีหน้าที่แค่บอกกลุ่มกว้างๆ พอ
 */
export const ADMIN_ORDER_STATUS_BADGE: Record<string, string> = {
  pending_payment:  'badge-warn',
  paid:             'badge-ok',
  preorder_waiting: 'badge-info',
  awaiting_balance: 'badge-warn',
  packing:          'badge-info',
  shipped:          'badge-info',
  delivered:        'badge-ok',
  completed:        'badge-ok',
  cancelled:        'badge-quiet',
}
