import type {
  CarrierAdapter, CreateShipmentInput, CreateShipmentResult,
  RateInput, RateResult, ShipmentEvent,
} from './types'

/**
 * Flash Express Open API
 * เอกสาร: https://open-docs.flashexpress.com/
 * Production: https://open-api.flashexpress.com
 *
 * สถานะ: โครงพร้อม — ต้องเติมการเซ็น signature และ endpoint จริงหลังได้ API key
 *
 * สำคัญ: ต้องส่ง merchantRef ทุกครั้งและเช็คก่อนสร้างซ้ำ
 * เพราะ API อาจ timeout ทั้งที่สร้างพัสดุสำเร็จแล้ว -> ได้เลขซ้ำและถูกเรียกเก็บ 2 ครั้ง
 */
export const flashAdapter: CarrierAdapter = {
  code: 'flash',
  nameTh: 'Flash Express',

  async estimateRate(input: RateInput): Promise<RateResult> {
    // TODO: POST /open/v1/orders/estimate_rate
    const kg = Math.max(1, Math.ceil(input.weightGrams / 1000))
    return { fee: 32 + (kg - 1) * 12, etaDays: 2 }
  },

  async createShipment(_input: CreateShipmentInput): Promise<CreateShipmentResult> {
    throw new Error('Flash API ยังไม่ได้เชื่อมต่อ — ใส่ FLASH_API_KEY แล้วเติม endpoint ในไฟล์นี้')
  },

  async cancelShipment(_trackingNo: string): Promise<void> {
    throw new Error('Flash API ยังไม่ได้เชื่อมต่อ')
  },

  verifyWebhook(_body: string, _headers: Headers): boolean {
    // TODO: ตรวจ signature ตามเอกสาร Flash ก่อนรับ event
    return false
  },

  parseWebhook(_body: unknown): ShipmentEvent[] {
    return []
  },
}
