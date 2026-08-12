import type {
  CarrierAdapter, CreateShipmentInput, CreateShipmentResult,
  RateInput, RateResult, ShipmentEvent,
} from './types'

/**
 * J&T Express
 * ต้องติดต่อฝ่ายขายเพื่อขอ API credential และเอกสาร — เริ่มกระบวนการตั้งแต่สัปดาห์แรก
 */
export const jntAdapter: CarrierAdapter = {
  code: 'jnt',
  nameTh: 'J&T Express',

  async estimateRate(input: RateInput): Promise<RateResult> {
    const kg = Math.max(1, Math.ceil(input.weightGrams / 1000))
    return { fee: 30 + (kg - 1) * 13, etaDays: 3 }
  },

  async createShipment(_input: CreateShipmentInput): Promise<CreateShipmentResult> {
    throw new Error('J&T API ยังไม่ได้เชื่อมต่อ — รอ credential จากฝ่ายขาย')
  },

  async cancelShipment(_trackingNo: string): Promise<void> {
    throw new Error('J&T API ยังไม่ได้เชื่อมต่อ')
  },

  verifyWebhook(_body: string, _headers: Headers): boolean {
    return false
  },

  parseWebhook(_body: unknown): ShipmentEvent[] {
    return []
  },
}
