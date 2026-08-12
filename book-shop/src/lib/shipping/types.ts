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
}

export interface CreateShipmentResult {
  trackingNo: string
  carrierOrderId: string
  labelUrl: string | null
  cost: number
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
  code: 'flash' | 'jnt'
  nameTh: string
  estimateRate(input: RateInput): Promise<RateResult>
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>
  cancelShipment(trackingNo: string): Promise<void>
  verifyWebhook(body: string, headers: Headers): boolean
  parseWebhook(body: unknown): ShipmentEvent[]
}
