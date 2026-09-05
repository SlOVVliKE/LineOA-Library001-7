/**
 * Adapter กลางสำหรับขนส่งทุกเจ้า
 * เพิ่มเจ้าที่ 3 ได้โดยไม่ต้องแตะโค้ดออเดอร์
 */

export interface RateInput {
  weightGrams: number
  destProvince: string
  destPostcode: string
  codAmount?: number
}

export interface RateResult {
  fee: number
  etaDays: number
}

export interface CreateShipmentInput {
  merchantRef: string // idempotency key ของเรา — สำคัญมาก
  orderNo: string
  recipientName: string
  recipientPhone: string
  address: {
    line1: string
    subdistrict?: string | null
    district?: string | null
    province: string
    postcode: string
  }
  weightGrams: number
  codAmount?: number
  itemDescription: string
  /**
   * ใช้เฉพาะขนส่งที่เป็นตัวรวมหลายเจ้า (ShipPop) — ต้องบอกว่าจะให้เจ้าไหนวิ่งจริง
   * เจ้าที่ส่งเองอย่าง Flash/J&T ไม่ต้องส่งค่านี้
   */
  courierCode?: string
}

export interface CreateShipmentResult {
  trackingNo: string
  carrierOrderId: string
  labelUrl: string | null
  cost: number
  /**
   * เลขพัสดุของขนส่งจริง สำหรับเจ้าที่เป็นตัวรวมหลายเจ้า (ShipPop) ซึ่งจะมีเลขสองชุด:
   * เลขของ ShipPop เอง (SP…) กับเลขของขนส่งที่วิ่งจริง (เช่น ST…ST ของไปรษณีย์)
   * ลูกค้าเอาไปเช็คสถานะกับขนส่งได้ด้วยเลขชุดหลัง และการยกเลิกก็ใช้เลขชุดนี้
   */
  courierTrackingNo?: string | null
}

export type ShipmentStatus =
  | 'created' | 'picked_up' | 'in_transit'
  | 'delivered' | 'failed' | 'returned' | 'cancelled'

export interface ShipmentEvent {
  trackingNo: string
  status: ShipmentStatus
  description: string
  occurredAt: Date
  raw: unknown
}

export interface CarrierAdapter {
  code: 'flash' | 'jnt' | 'shippop'
  nameTh: string
  estimateRate(input: RateInput): Promise<RateResult>
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>
  cancelShipment(trackingNo: string): Promise<void>
  verifyWebhook(body: string, headers: Headers): boolean
  parseWebhook(body: unknown): ShipmentEvent[]
}
