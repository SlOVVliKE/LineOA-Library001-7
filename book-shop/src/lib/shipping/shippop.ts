import type {
  CarrierAdapter, CreateShipmentInput, CreateShipmentResult,
  RateInput, RateResult, ShipmentEvent, ShipmentStatus,
} from './types'

/**
 * ShipPop — ตัวรวมขนส่งหลายเจ้า (ไปรษณีย์ไทย/Flash/J&T/Kerry/Best/SPX ฯลฯ)
 * เอกสาร: https://documenter.getpostman.com/view/10021496/Tzz8qwkE
 *
 * sandbox: https://mkpservice.shippop.dev   production: https://mkpservice.shippop.com
 *
 * ต่างจาก adapter เจ้าอื่นตรงที่ ShipPop ไม่ได้ส่งของเอง แต่เป็นคนกลาง เราจึงต้องเลือก
 * `courier_code` ของขนส่งจริงตอนจอง — ได้มาจากผลลัพธ์ /pricelist/ ไม่ใช่ฮาร์ดโค้ด
 * เพราะรายชื่อขนส่งที่ใช้ได้ขึ้นกับปลายทาง/น้ำหนัก/บัญชีของร้าน
 *
 * **รูปแบบ body ไม่เหมือนกันทุกเส้น** (ตามเอกสาร ไม่ใช่เดา):
 *   /pricelist/ /booking/ /cancel/  → raw JSON
 *   /confirm/                       → form-data
 * และ `data` ของ /pricelist/ เป็น object ที่ key เป็นเลข ("0") ส่วนของ /booking/ เป็น array
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
 * URL ที่ต้องเอาไปให้ ShipPop ลงทะเบียนให้
 *
 * ShipPop **ไม่ได้ให้ตั้ง webhook เองจากหน้าเว็บ และไม่ได้รับค่านี้ตอนจอง** —
 * เอกสารระบุว่าต้องติดต่อทีม Dev SHIPPOP ทาง LINE (https://lin.ee/O1ngU4e) ให้ตั้งให้
 * ฟังก์ชันนี้จึงมีไว้ "แสดงให้ดูว่าจะต้องส่ง URL ไหนไปให้เขา" ไม่ได้ถูกส่งไปกับ request
 *
 * token ท้าย URL คือด่านตรวจเดียวที่เรามี เพราะ ShipPop ไม่เซ็นลายเซ็น callback
 */
export function shippopWebhookUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const secret = process.env.SHIPPOP_WEBHOOK_SECRET
  if (!appUrl || !secret) return null

  return `${appUrl.replace(/\/+$/, '')}/api/shipping/shippop/webhook?token=${encodeURIComponent(secret)}`
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
 * ยืนยันจากตัวอย่างจริงในเอกสาร: {"district": "สีลม", "state": "บางรัก"}
 * (สีลมเป็นแขวง บางรักเป็นเขต) ถ้าแมปกลับกัน ShipPop จะยังรับจองแต่รถเข้าผิดที่
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

function parcelOf(input: CreateShipmentInput) {
  return {
    name: input.itemDescription,
    // หน่วยเป็นกรัม ส่วน width/length/height เป็นเซนติเมตร
    weight: Math.max(1, Math.round(input.weightGrams)),
    width: 20,
    length: 25,
    height: 10,
  }
}

/**
 * ShipPop ตอบ error มาได้หลายรูปแบบ (บางเส้น { error: {...} } บางเส้น { status: false })
 * และตอบ HTTP 200 ทั้งที่งานไม่สำเร็จ จึงต้องตรวจ body เองทุกครั้ง ห้ามดูแค่ res.ok
 */
async function callShippop(
  path: string,
  payload: Record<string, unknown>,
  mode: 'json' | 'form' = 'json'
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers:
      mode === 'json'
        ? { 'content-type': 'application/json' }
        : { 'content-type': 'application/x-www-form-urlencoded' },
    body:
      mode === 'json'
        ? JSON.stringify(payload)
        : new URLSearchParams(
            Object.entries(payload).map(([k, v]) => [k, String(v)])
          ).toString(),
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
  /** ข้อความบอกระยะเวลาจาก ShipPop เช่น "ภายใน 1 - 2 วัน" */
  estimateTime: string | null
}

/**
 * ถามราคาจากทุกขนส่งที่ปลายทางนี้ใช้ได้ (showall=1)
 * ใช้ผลลัพธ์นี้เป็นตัวเลือกให้แอดมินกดเลือกก่อนจอง — ดีกว่าฮาร์ดโค้ด courier_code
 * เพราะรายชื่อที่ใช้ได้ขึ้นกับปลายทาง น้ำหนัก และบัญชีร้าน
 *
 * รูปแบบผลลัพธ์: data["0"]["FLE"] = { courier_code, courier_name, price, estimate_time, available }
 * ("0" คือลำดับพัสดุที่ถามไป เราถามทีละใบจึงมีแค่ "0")
 */
export async function listShippopQuotes(input: CreateShipmentInput): Promise<ShippopQuote[]> {
  const json = await callShippop('/pricelist/', {
    api_key: apiKey(),
    // /pricelist/ ใช้ data เป็น object ที่ key เป็นเลข ต่างจาก /booking/ ที่เป็น array
    data: {
      '0': {
        from: senderAddress(),
        to: toShippopAddress(input),
        parcel: parcelOf(input),
        showall: 1,
        ...(input.codAmount ? { cod_amount: input.codAmount } : {}),
      },
    },
  })

  const rows = collectQuoteRows((json.data as Record<string, unknown>)?.['0'])
  if (!rows.length) {
    throw new Error(`อ่านผลราคาจาก ShipPop ไม่ออก: ${JSON.stringify(json).slice(0, 300)}`)
  }

  // ตัดเจ้าที่ available=false ออก — ขึ้นมาในผลลัพธ์ได้แต่จองไม่ได้จริง
  return rows.filter((r) => r.price > 0)
}

function collectQuoteRows(node: unknown): ShippopQuote[] {
  if (!node || typeof node !== 'object') return []

  return Object.values(node as Record<string, unknown>).flatMap((child) => {
    if (!child || typeof child !== 'object') return []
    const c = child as Record<string, unknown>
    if (!c.courier_code) return []
    if (c.available === false) return []

    return [
      {
        courierCode: String(c.courier_code),
        courierName: String(c.courier_name ?? c.courier_code),
        price: Number(c.price ?? 0),
        estimateTime: c.estimate_time ? String(c.estimate_time) : null,
      },
    ]
  })
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
   *   /booking/ (JSON)  → ได้ purchase_id + tracking_code (ยังไม่ตัดเครดิต)
   *   /confirm/ (form)  → ยืนยัน ตรงนี้แหละที่ตัดเครดิตและสร้างรายการกับขนส่งจริง
   *
   * ข้อควรระวัง: `/confirm/` ล้มเหลวรายรายการได้ทั้งที่ status ข้างนอกเป็น true
   * (เช่นเบอร์โทรผิดรูปแบบ)
   * จึงต้องไล่เช็ค result[*].status ทุกใบ ไม่งั้นเราจะบันทึกเลขพัสดุที่ขนส่งไม่เคยรับจริง
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

    const booking = await callShippop('/booking/', {
      api_key: apiKey(),
      email: process.env.SHIPPOP_EMAIL || 'noreply@example.com',
      // /booking/ ใช้ data เป็น array ต่างจาก /pricelist/ ที่เป็น object
      data: [
        {
          from: senderAddress(),
          to: toShippopAddress(input),
          parcel: parcelOf(input),
          courier_code: courierCode,
          ...(input.codAmount ? { cod_amount: input.codAmount } : {}),
        },
      ],
    })

    const purchaseId = String(booking.purchase_id ?? '')
    const trackingNo = extractTrackingCode(booking)

    if (!purchaseId || !trackingNo) {
      throw new Error(
        `ShipPop จองแล้วแต่ไม่พบ purchase_id/tracking_code: ${JSON.stringify(booking).slice(0, 300)}`
      )
    }

    let confirm: Record<string, unknown>
    try {
      confirm = await callShippop(
        '/confirm/',
        { api_key: apiKey(), purchase_id: purchaseId },
        'form'
      )
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      throw new Error(
        `จองสำเร็จ (purchase_id ${purchaseId}) แต่ยืนยันไม่ผ่าน: ${reason} — ` +
        'ต้องเข้าไปยืนยันหรือยกเลิกใน ShipPop เอง ไม่งั้น booking จะค้าง'
      )
    }

    const item = findConfirmItem(confirm, trackingNo)
    if (item && item.status === false) {
      throw new Error(
        `ShipPop ยืนยันรายการไม่สำเร็จ (${trackingNo}): ${String(item.message ?? 'ไม่ทราบสาเหตุ')} — ` +
        `purchase_id ${purchaseId} ค้างอยู่ ต้องเข้าไปจัดการใน ShipPop`
      )
    }

    return {
      trackingNo,
      // เลขของขนส่งจริง (เช่น ST499959975ST ของไปรษณีย์) ได้ตอน confirm ไม่ใช่ตอน booking
      courierTrackingNo: item?.courier_tracking_code ? String(item.courier_tracking_code) : null,
      carrierOrderId: purchaseId,
      // ใบปะหน้าเป็น POST /label_tracking_code/ ไม่ใช่ URL ที่เปิดตรงได้ จึงยังไม่มีลิงก์ให้เก็บ
      labelUrl: null,
      cost: Number(booking.total_price ?? 0),
    }
  },

  /**
   * ยกเลิกด้วย `courier_tracking_code` (เลขของขนส่งจริง) ไม่ใช่ tracking_code ของ ShipPop
   * — ตามตัวอย่างในเอกสาร 3.4 CANCEL ORDER
   */
  async cancelShipment(courierTrackingNo: string): Promise<void> {
    await callShippop('/cancel/', {
      api_key: apiKey(),
      courier_tracking_code: courierTrackingNo,
    })
  },

  /**
   * ShipPop ไม่ได้เซ็นลายเซ็น callback มาให้ — ด่านเดียวที่เรามีคือ token ลับที่ฝังอยู่ใน
   * URL ที่เราให้ทีม ShipPop ไปลงทะเบียน แล้วเช็คว่าที่ยิงกลับมามี token ตรงกัน
   * (route เป็นคนดึง token จาก query string มาใส่ header ให้ก่อนเรียกตัวนี้)
   */
  verifyWebhook(_body: string, headers: Headers): boolean {
    const secret = process.env.SHIPPOP_WEBHOOK_SECRET
    if (!secret) return false
    return headers.get('x-shippop-token') === secret
  },

  /**
   * payload ที่ ShipPop ยิงมาเป็น form-urlencoded 4 ฟิลด์ (เอกสารหัวข้อ 7.1):
   *   tracking_code, order_status, courier_tracking_code, data[datetime]
   *
   * ชื่อฟิลด์สถานะคือ `order_status` ไม่ใช่ `status` และเวลาอยู่ใน key ชื่อ `data[datetime]`
   * ตรงตัว (เพราะ urlencoded ไม่ได้แตกเป็น object ให้) — ยังรับ JSON เผื่อไว้ด้วย
   * เพราะเอกสารบอกว่าขอให้ ShipPop เปลี่ยนเป็น JSON ได้ถ้าติดต่อไป
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

      const trackingNo = String(obj.tracking_code ?? '')
      if (!trackingNo) return []

      const rawStatus = String(obj.order_status ?? obj.status ?? '')
      const nested = obj.data as Record<string, unknown> | undefined
      const datetime = obj['data[datetime]'] ?? nested?.datetime

      return [
        {
          trackingNo,
          status: mapStatus(rawStatus),
          description: describeStatus(rawStatus, obj),
          occurredAt: parseDate(datetime),
          raw: row,
        },
      ]
    })
  },
}

/** หา tracking_code จาก data ของ /booking/ (เป็น array หรือ object ที่ key เป็นเลขก็ได้) */
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

/** หาแถวผลลัพธ์ของพัสดุใบที่เราจองใน response ของ /confirm/ (`result` key เป็นเลข) */
function findConfirmItem(
  confirm: Record<string, unknown>,
  trackingNo: string
): Record<string, unknown> | null {
  const result = confirm.result as unknown
  const rows =
    result && typeof result === 'object'
      ? Object.values(result as Record<string, unknown>)
      : []

  for (const row of rows) {
    if (row && typeof row === 'object') {
      const r = row as Record<string, unknown>
      if (String(r.tracking_code ?? '') === trackingNo) return r
    }
  }
  return null
}

/**
 * แปลงสถานะของ ShipPop เป็นสถานะในระบบเรา (ตามเอกสารหัวข้อ 7 Webhook Status)
 *
 * ค่าที่ ShipPop ส่งมาจริง: booking / cancel / shipping / package_detail / problem /
 * complete / return / pending_transfer / transferred / rider_accept
 *
 * ที่พลาดง่าย: "ส่งถึงแล้ว" ของ ShipPop คือคำว่า **complete** ไม่ใช่ delivered
 * และ "shipping" หมายถึงขนส่งเข้ารับพัสดุแล้ว (picked up) ไม่ใช่กำลังวิ่งส่ง
 */
function mapStatus(raw: string): ShipmentStatus {
  switch (raw.toLowerCase().trim()) {
    case 'booking':
      return 'created'
    case 'cancel':
      return 'cancelled'
    case 'shipping':
      return 'picked_up'
    case 'complete':
      return 'delivered'
    case 'return':
      return 'returned'
    case 'problem':
      return 'failed'
    // อัปเดตน้ำหนัก/ค่าส่ง และสถานะฝั่งโอนเงิน COD ไม่ได้เปลี่ยนตำแหน่งพัสดุ
    case 'package_detail':
    case 'pending_transfer':
    case 'transferred':
    case 'rider_accept':
      return 'in_transit'
    default:
      return 'in_transit'
  }
}

const STATUS_TEXT: Record<string, string> = {
  booking: 'ยืนยันรายการกับขนส่งแล้ว',
  cancel: 'ยกเลิกรายการ',
  shipping: 'ขนส่งเข้ารับพัสดุแล้ว',
  package_detail: 'อัปเดตน้ำหนัก/ค่าส่ง',
  problem: 'พัสดุมีปัญหา',
  complete: 'จัดส่งสำเร็จ',
  return: 'ตีกลับต้นทาง',
  pending_transfer: 'กำลังโอนเงิน COD คืน',
  transferred: 'โอนเงิน COD คืนแล้ว',
  rider_accept: 'คนขับรับงานแล้ว',
}

function describeStatus(raw: string, obj: Record<string, unknown>): string {
  const base = STATUS_TEXT[raw.toLowerCase().trim()] ?? raw ?? 'ไม่มีรายละเอียด'
  const courier = obj.courier_tracking_code
  return courier ? `${base} (เลขขนส่ง ${String(courier)})` : base
}

function parseDate(value: unknown): Date {
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}
