import type {
  CarrierAdapter, CreateShipmentInput, CreateShipmentResult,
  RateInput, RateResult, ShipmentEvent, ShipmentStatus,
} from './types'

/**
 * ShipPop — ตัวรวมขนส่งหลายเจ้า (ไปรษณีย์ไทย/Flash/J&T/Kerry/Ninja ฯลฯ)
 * เอกสาร: https://documenter.getpostman.com/view/10021496/Tzz8qwkE
 *
 * sandbox: https://mkpservice.shippop.dev   production: https://mkpservice.shippop.com
 *
 * ต่างจาก adapter เจ้าอื่นตรงที่ ShipPop ไม่ได้ส่งของเอง แต่เป็นคนกลาง เราจึงต้อง
 * เลือก `courier_code` ของขนส่งจริงตอนจอง — ซึ่งได้มาจากผลลัพธ์ /pricelist/ ไม่ใช่
 * ฮาร์ดโค้ดไว้ เพราะรายชื่อขนส่งที่ใช้ได้ขึ้นกับปลายทาง/น้ำหนัก/บัญชีของร้าน
 */

const DEFAULT_BASE_URL = 'https://mkpservice.shippop.dev'

function baseUrl(): string {
  return (process.env.SHIPPOP_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function apiKey(): string {
  const key = process.env.SHIPPOP_API_KEY
  if (!key) {
    throw new Error(
      'ยังไม่ได้ตั้ง SHIPPOP_API_KEY — ใส่คีย์ sandbox ใน .env.local ก่อนใช้งาน ShipPop'
    )
  }
  return key
}

export function isShippopConfigured(): boolean {
  return !!process.env.SHIPPOP_API_KEY
}

/** ใช้ sandbox อยู่หรือเปล่า — เอาไว้เตือนบนหน้าจอว่ายังไม่ใช่ของจริง */
export function isShippopSandbox(): boolean {
  return !baseUrl().includes('shippop.com')
}

/**
 * ที่อยู่ผู้ส่ง (ร้าน) — ShipPop บังคับให้แยกฟิลด์ จะยัดเป็นข้อความก้อนเดียวไม่ได้
 * ตั้งค่าใน .env.local: SHIPPOP_SENDER_NAME / _ADDRESS / _SUBDISTRICT / _DISTRICT /
 * _PROVINCE / _POSTCODE / _TEL
 */
function senderAddress(): ShippopAddress {
  const required = {
    name: process.env.SHIPPOP_SENDER_NAME,
    address: process.env.SHIPPOP_SENDER_ADDRESS,
    district: process.env.SHIPPOP_SENDER_SUBDISTRICT,
    state: process.env.SHIPPOP_SENDER_DISTRICT,
    province: process.env.SHIPPOP_SENDER_PROVINCE,
    postcode: process.env.SHIPPOP_SENDER_POSTCODE,
    tel: process.env.SHIPPOP_SENDER_TEL,
  }

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k)

  if (missing.length) {
    throw new Error(
      `ที่อยู่ผู้ส่งยังไม่ครบ (ขาด ${missing.join(', ')}) — เติม SHIPPOP_SENDER_* ใน .env.local`
    )
  }

  return required as ShippopAddress
}

interface ShippopAddress {
  name: string
  address: string
  /** ShipPop เรียก district = แขวง/ตำบล (ไม่ใช่เขต/อำเภอ) */
  district: string
  /** ShipPop เรียก state = เขต/อำเภอ */
  state: string
  province: string
  postcode: string
  tel: string
}

/**
 * ที่อยู่ผู้รับจาก schema เรา → รูปแบบ ShipPop
 *
 * **จุดพลาดง่ายที่สุดของทั้งไฟล์**: ชื่อฟิลด์สลับกับที่เราใช้
 *   ของเรา subdistrict (แขวง/ตำบล) → ShipPop `district`
 *   ของเรา district    (เขต/อำเภอ) → ShipPop `state`
 * ถ้าแมปกลับกัน ที่อยู่จะผิดแบบที่ระบบ ShipPop ยังรับจอง แต่รถเข้าไปรับ/ส่งไม่ถูกที่
 */
function toShippopAddress(input: CreateShipmentInput): ShippopAddress {
  return {
    name: input.recipientName,
    address: input.address.line1,
    district: input.address.subdistrict ?? '-',
    state: input.address.district ?? '-',
    province: input.address.province,
    postcode: input.address.postcode,
    tel: input.recipientPhone,
  }
}

/**
 * ShipPop รับ body เป็น form-urlencoded แบบ bracket notation ของ PHP
 * เช่น data[0][from][name]=... ไม่ใช่ JSON ก้อนเดียว
 */
function toFormBody(payload: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams()

  function walk(value: unknown, path: string) {
    if (value === null || value === undefined) return

    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, path ? `${path}[${k}]` : k)
      }
      return
    }
    params.set(path, String(value))
  }

  walk(payload, '')
  return params
}

/**
 * ShipPop ตอบ error มาได้หลายรูปแบบ (บางเส้น { error: {...} } บางเส้น { status: false })
 * และตอบ HTTP 200 ทั้งที่งานไม่สำเร็จ จึงต้องตรวจ body เองทุกครั้ง ห้ามดูแค่ res.ok
 */
async function callShippop(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: toFormBody(payload).toString(),
  })

  const text = await res.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`ShipPop ตอบกลับไม่ใช่ JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }

  const error = json.error as { message?: string; status?: number } | undefined
  if (error) {
    throw new Error(`ShipPop ปฏิเสธ: ${error.message ?? JSON.stringify(error)}`)
  }
  if (json.status === false) {
    throw new Error(`ShipPop ปฏิเสธ: ${String(json.message ?? 'ไม่ทราบสาเหตุ')}`)
  }

  return json
}

export interface ShippopQuote {
  courierCode: string
  courierName: string
  price: number
  /** ข้อความบอกระยะเวลาจาก ShipPop เช่น "1-2 วัน" — ไม่ได้มีทุกเจ้า */
  deliveryTime: string | null
}

/**
 * ถามราคาจากทุกขนส่งที่ปลายทางนี้ใช้ได้ (showall=1)
 * ใช้ผลลัพธ์นี้เป็นตัวเลือกให้แอดมินกดเลือกก่อนจอง — ดีกว่าฮาร์ดโค้ด courier_code
 * เพราะรายชื่อที่ใช้ได้ขึ้นกับปลายทาง น้ำหนัก และบัญชีร้าน
 */
export async function listShippopQuotes(input: CreateShipmentInput): Promise<ShippopQuote[]> {
  const json = await callShippop('/pricelist/', {
    api_key: apiKey(),
    data: [
      {
        from: senderAddress(),
        to: toShippopAddress(input),
        parcel: {
          name: input.itemDescription,
          weight: Math.max(1, Math.round(input.weightGrams)),
          width: 1,
          length: 1,
          height: 1,
        },
        showall: 1,
        ...(input.codAmount ? { cod_amount: input.codAmount } : {}),
      },
    ],
  })

  return parseQuotes(json)
}

/**
 * รูปร่าง response ของ /pricelist/ ต่างกันตามเวอร์ชัน (บางทีเป็น data["0"].list
 * บางทีเป็น data[0].couriers) จึงเดินหาแบบยืดหยุ่นแทนการ fix path เดียว
 * ถ้าอ่านไม่ออกเลยให้โยน error พร้อมของดิบ จะได้แก้ได้เร็วตอนเจอของจริง
 */
function parseQuotes(json: Record<string, unknown>): ShippopQuote[] {
  const data = json.data as unknown
  const first = Array.isArray(data)
    ? data[0]
    : data && typeof data === 'object'
      ? Object.values(data as Record<string, unknown>)[0]
      : undefined

  const rows = collectQuoteRows(first)
  if (!rows.length) {
    throw new Error(`อ่านผลราคาจาก ShipPop ไม่ออก: ${JSON.stringify(json).slice(0, 300)}`)
  }

  return rows
}

function collectQuoteRows(node: unknown): ShippopQuote[] {
  if (!node || typeof node !== 'object') return []

  const obj = node as Record<string, unknown>

  // ตัวมันเองเป็นรายการราคาหนึ่งแถว
  if (obj.courier_code && (obj.price !== undefined || obj.total !== undefined)) {
    return [
      {
        courierCode: String(obj.courier_code),
        courierName: String(obj.courier_name ?? obj.name ?? obj.courier_code),
        price: Number(obj.price ?? obj.total ?? 0),
        deliveryTime: obj.delivery_time ? String(obj.delivery_time) : null,
      },
    ]
  }

  // ไม่งั้นไล่ลงไปในลูกทุกตัว (รองรับทั้ง array และ object ที่ key เป็นเลข)
  return Object.values(obj).flatMap((child) => collectQuoteRows(child))
}

export const shippopAdapter: CarrierAdapter = {
  code: 'shippop',
  nameTh: 'ShipPop',

  /**
   * เลือกราคาถูกที่สุดที่ปลายทางนี้ใช้ได้ — interface กลางคืนได้ค่าเดียว
   * ถ้าอยากให้แอดมินเลือกเจ้าเอง ให้เรียก listShippopQuotes() ตรงๆ แทน
   */
  async estimateRate(input: RateInput): Promise<RateResult> {
    const quotes = await listShippopQuotes({
      merchantRef: 'rate-check',
      orderNo: 'rate-check',
      recipientName: 'ผู้รับ',
      recipientPhone: '0800000000',
      address: {
        line1: '-',
        subdistrict: null,
        district: null,
        province: input.destProvince,
        postcode: input.destPostcode,
      },
      weightGrams: input.weightGrams,
      codAmount: input.codAmount,
      itemDescription: 'หนังสือ',
    })

    const cheapest = quotes.reduce((min, q) => (q.price < min.price ? q : min))
    return { fee: cheapest.price, etaDays: 2 }
  },

  /**
   * จองพัสดุ = 2 จังหวะเสมอ
   *   /booking/ → ได้ purchase_id + tracking_code (ยังไม่ตัดเครดิต)
   *   /confirm/ → ยืนยัน ตรงนี้แหละที่ตัดเครดิตจริงและพัสดุถูกส่งเข้าระบบขนส่ง
   *
   * ถ้า /confirm/ พังหลัง /booking/ สำเร็จ จะเหลือ booking ค้างที่ยังไม่ถูกใช้ —
   * เราโยน error ออกไปพร้อมเลข purchase_id เพื่อให้ตามเก็บได้ ไม่ใช่กลืนเงียบ
   *
   * ผู้เรียกต้องเช็ค merchant_ref ในตาราง shipments ก่อนเรียกฟังก์ชันนี้เสมอ
   * (unique constraint มีอยู่แล้ว) เพราะ API อาจ timeout ทั้งที่จองสำเร็จ
   * → ยิงซ้ำจะได้พัสดุสองใบและถูกเรียกเก็บสองครั้ง
   */
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const courierCode = input.courierCode
    if (!courierCode) {
      throw new Error('ต้องระบุ courier_code ของ ShipPop ก่อนจอง (เลือกจากผลเช็คราคา)')
    }

    const callbackUrl = webhookUrl()

    const booking = await callShippop('/booking/', {
      api_key: apiKey(),
      email: process.env.SHIPPOP_EMAIL || 'noreply@example.com',
      data: [
        {
          from: senderAddress(),
          to: toShippopAddress(input),
          parcel: {
            name: input.itemDescription,
            weight: Math.max(1, Math.round(input.weightGrams)),
            width: 1,
            length: 1,
            height: 1,
          },
          courier_code: courierCode,
          ...(input.codAmount ? { cod_amount: input.codAmount } : {}),
        },
      ],
      ...(callbackUrl ? { url: { success: callbackUrl, fail: callbackUrl } } : {}),
    })

    const purchaseId = String(booking.purchase_id ?? '')
    const trackingNo = extractTrackingCode(booking)

    if (!purchaseId || !trackingNo) {
      throw new Error(`ShipPop จองแล้วแต่ไม่พบ purchase_id/tracking_code: ${JSON.stringify(booking).slice(0, 300)}`)
    }

    try {
      await callShippop('/confirm/', { api_key: apiKey(), purchase_id: purchaseId })
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      throw new Error(
        `จองสำเร็จ (purchase_id ${purchaseId}) แต่ยืนยันไม่ผ่าน: ${reason} — ` +
        'ต้องเข้าไปยืนยันหรือยกเลิกใน ShipPop เอง ไม่งั้น booking จะค้าง'
      )
    }

    return {
      trackingNo,
      carrierOrderId: purchaseId,
      labelUrl: `${baseUrl()}/v2/label/?tracking_code=${encodeURIComponent(trackingNo)}`,
      cost: Number(booking.total ?? booking.price ?? 0),
    }
  },

  /**
   * เอกสารสาธารณะไม่ได้ระบุ body ของ /cancel/ ครบ — ใช้รูปแบบเดียวกับเส้นอื่น
   * (api_key + tracking_code) ไว้ก่อน ต้องยืนยันกับ sandbox อีกทีตอนใช้จริง
   */
  async cancelShipment(trackingNo: string): Promise<void> {
    await callShippop('/cancel/', { api_key: apiKey(), tracking_code: trackingNo })
  },

  /**
   * ShipPop ไม่ได้เซ็นลายเซ็น callback มาให้ — ด่านเดียวที่เรามีคือ token ลับ
   * ที่เราแนบไปเองกับ url[success] ตอนจอง แล้วเช็คว่าที่ยิงกลับมามี token ตรงกัน
   * (route เป็นคนดึง token จาก query string มาใส่ header ให้ก่อนเรียกตัวนี้)
   */
  verifyWebhook(_body: string, headers: Headers): boolean {
    const secret = process.env.SHIPPOP_WEBHOOK_SECRET
    if (!secret) return false
    return headers.get('x-shippop-token') === secret
  },

  /**
   * โครงสร้าง payload ที่ ShipPop ยิงกลับไม่มีในเอกสารสาธารณะ — ตัวนี้จึงอ่านแบบ
   * ยืดหยุ่น (รับได้ทั้งก้อนเดียวและ array) และเก็บของดิบไว้ใน raw ทุกครั้ง
   * เจอ callback จริงใบแรกเมื่อไหร่ค่อยรัดให้ตรงขึ้น
   */
  parseWebhook(body: unknown): ShipmentEvent[] {
    const rows = Array.isArray(body)
      ? body
      : body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>).data)
        ? ((body as Record<string, unknown>).data as unknown[])
        : [body]

    return rows.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const obj = row as Record<string, unknown>

      const trackingNo = String(obj.tracking_code ?? obj.tracking_no ?? '')
      if (!trackingNo) return []

      const rawStatus = String(obj.status ?? obj.state ?? '')
      return [
        {
          trackingNo,
          status: mapStatus(rawStatus),
          description: String(obj.detail ?? obj.message ?? (rawStatus || 'ไม่มีรายละเอียด')),
          occurredAt: parseDate(obj.datetime ?? obj.updated_at ?? obj.date),
          raw: row,
        },
      ]
    })
  },
}

function extractTrackingCode(booking: Record<string, unknown>): string {
  if (booking.tracking_code) return String(booking.tracking_code)

  const data = booking.data as unknown
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? Object.values(data as Record<string, unknown>)
      : []

  for (const row of rows) {
    if (row && typeof row === 'object') {
      const code = (row as Record<string, unknown>).tracking_code
      if (code) return String(code)
    }
  }
  return ''
}

/**
 * ShipPop ใช้คำสถานะไม่เหมือนกันทุกขนส่ง จึงจับจากคำสำคัญแทนการเทียบตรงตัว
 * ถ้าไม่รู้จักให้เป็น 'in_transit' — ปลอดภัยกว่าเดาว่าส่งถึงหรือส่งไม่สำเร็จ
 * (ผู้เรียกจะไม่อัปเดตสถานะออเดอร์จากค่าที่เดาไม่ได้)
 */
function mapStatus(raw: string): ShipmentStatus {
  const s = raw.toLowerCase()
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('return')) return 'returned'
  if (s.includes('fail') || s.includes('reject')) return 'failed'
  if (s.includes('deliver') && !s.includes('out for')) return 'delivered'
  if (s.includes('pickup') || s.includes('pick up') || s.includes('picked')) return 'picked_up'
  if (s.includes('transit') || s.includes('shipping') || s.includes('out for')) return 'in_transit'
  if (s.includes('book') || s.includes('pending') || s.includes('created')) return 'created'
  return 'in_transit'
}

function parseDate(value: unknown): Date {
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

/**
 * URL ที่ให้ ShipPop ยิงสถานะกลับ — ต้องเป็น public URL เท่านั้น
 * ตอนรันในเครื่อง (localhost) จะไม่แนบไปเลย เพราะ ShipPop ยิงกลับมาไม่ถึงอยู่ดี
 */
function webhookUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const secret = process.env.SHIPPOP_WEBHOOK_SECRET
  if (!appUrl || !secret) return null
  if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) return null

  return `${appUrl.replace(/\/+$/, '')}/api/shipping/shippop/webhook?token=${encodeURIComponent(secret)}`
}
