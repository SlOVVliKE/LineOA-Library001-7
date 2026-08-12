export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment:  'รอชำระเงิน',
  paid:             'ชำระเงินแล้ว',
  preorder_waiting: 'รอของเข้า',
  awaiting_balance: 'รอชำระส่วนที่เหลือ',
  packing:          'กำลังแพ็ก',
  shipped:          'จัดส่งแล้ว',
  delivered:        'ถึงมือผู้รับ',
  completed:        'สำเร็จ',
  cancelled:        'ยกเลิก',
}

export const ORDER_STATUS_STYLE: Record<string, string> = {
  pending_payment:  'bg-amber-50 text-amber-700',
  paid:             'bg-teal-50 text-teal-700',
  preorder_waiting: 'bg-sky-50 text-sky-700',
  awaiting_balance: 'bg-amber-50 text-amber-700',
  packing:          'bg-sky-50 text-sky-700',
  shipped:          'bg-indigo-50 text-indigo-700',
  delivered:        'bg-teal-50 text-teal-700',
  completed:        'bg-teal-50 text-teal-700',
  cancelled:        'bg-neutral-100 text-neutral-500',
}

export const PAYMENT_PURPOSE_LABEL: Record<string, string> = {
  full:    'จ่ายเต็มจำนวน',
  deposit: 'มัดจำ',
  balance: 'ส่วนที่เหลือ',
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending:          'รอตรวจสอบ',
  auto_verified:    'ตรวจอัตโนมัติผ่าน',
  manual_verified:  'แอดมินยืนยันแล้ว',
  rejected:         'ปฏิเสธ',
}
