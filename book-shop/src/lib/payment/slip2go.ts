import 'server-only'

const API = 'https://connect.slip2go.com/api'

/**
 * ตรวจสลิปกับ Slip2Go
 *
 * เลือกใช้ endpoint แบบ base64 เพราะตอนลูกค้าอัปโหลด เรามีไฟล์อยู่ในมือ
 * ฝั่งเซิร์ฟเวอร์อยู่แล้ว ไม่ต้องทำ signed URL ให้บริการภายนอกเข้ามาดึงจาก
 * bucket ที่ตั้งใจปิดไว้ และไม่ต้องลงไลบรารีถอดรหัส QR เพิ่ม
 *
 * เอกสาร: https://slip2go.com/guide/rest-api/base64
 */

export interface Slip2GoResult {
  /** ผ่านทุกเงื่อนไข = ยืนยันเงินอัตโนมัติได้ */
  verified: boolean
  /** รหัสอ้างอิงธุรกรรมจากธนาคาร ใช้กันสลิปซ้ำในฐานข้อมูลเราอีกชั้น */
  transRef: string | null
  amount: number | null
  /** ข้อความอธิบายผล ใช้โชว์ให้ลูกค้าและเก็บลง log */
  message: string
  code: string
  /** payload ดิบ เก็บไว้ตรวจย้อนหลังเวลามีข้อพิพาทเรื่องเงิน */
  raw: unknown
}

export function isSlip2GoConfigured(): boolean {
  return Boolean(process.env.SLIP2GO_SECRET && process.env.PROMPTPAY_ID)
}

interface CheckReceiver {
  accountType?: string
  accountNumber?: string
  accountNameTH?: string
  accountNameEN?: string
}

/**
 * ส่งสลิปไปตรวจ พร้อมเงื่อนไข 3 ชั้น
 *
 *  1. checkAmount  — ยอดต้องตรงเป๊ะรวมเศษสตางค์ เพราะเศษสตางค์คือรหัสออเดอร์
 *  2. checkReceiver — เงินต้องเข้าบัญชีร้านเท่านั้น กันสลิปที่โอนไปที่อื่น
 *  3. checkDuplicate — กันสลิปใบเดิมถูกใช้ซ้ำข้ามออเดอร์
 *
 * ข้อ 3 สำคัญเป็นพิเศษ เพราะระบบเศษสตางค์ของเราบอกได้แค่ว่าสลิป "ตรงกับ"
 * ออเดอร์ไหน แต่บอกไม่ได้ว่าเคยถูกใช้ไปแล้วหรือยัง
 */
export async function verifySlipBase64(params: {
  base64: string
  expectedAmount: number
}): Promise<Slip2GoResult> {
  const secret = process.env.SLIP2GO_SECRET
  const promptpayId = process.env.PROMPTPAY_ID
  if (!secret || !promptpayId) {
    throw new Error('ยังไม่ได้ตั้งค่า SLIP2GO_SECRET หรือ PROMPTPAY_ID')
  }

  const receiver: CheckReceiver = {
    // 02001 = พร้อมเพย์ผูกเบอร์โทรศัพท์
    accountType: process.env.SLIP2GO_ACCOUNT_TYPE ?? '02001',
  }
  // ชื่อบัญชีใช้ตรวจได้แม่นกว่าเลขพร้อมเพย์ที่ธนาคารมักปิดบางหลัก
  if (process.env.SHOP_ACCOUNT_NAME_TH) {
    receiver.accountNameTH = process.env.SHOP_ACCOUNT_NAME_TH
  }

  const body = {
    payload: {
      base64: params.base64,
      checkCondition: {
        checkDuplicate: true,
        checkReceiver: [receiver],
        checkAmount: {
          type: 'eq',
          // เอกสารระบุว่าเป็น String และห้ามมีลูกน้ำ
          amount: params.expectedAmount.toFixed(2),
        },
      },
    },
  }

  // ตั้ง timeout เอง เพราะถ้า Slip2Go ค้าง ลูกค้าจะเห็นหน้าโหลดค้างไปเรื่อยๆ
  // แล้วกดส่งซ้ำ ซึ่งกินโควตาสลิปฟรีไปเปล่าๆ
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)

  try {
    const res = await fetch(`${API}/verify-slip/base64/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // เอกสารระบุให้ใส่ Secret ตรงๆ ไม่มีคำว่า Bearer นำหน้า
        Authorization: secret,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    })

    const json = (await res.json().catch(() => null)) as {
      code?: string
      message?: string
      data?: { transRef?: string; amount?: number }
    } | null

    if (!json) {
      return {
        verified: false, transRef: null, amount: null, code: 'PARSE_ERROR',
        message: `ตอบกลับไม่ถูกรูปแบบ (HTTP ${res.status})`, raw: null,
      }
    }

    // 2xxxxx = สำเร็จ ส่วนรหัสอื่นคือไม่ผ่านเงื่อนไข/สลิปปลอม/โควตาหมด
    const verified = typeof json.code === 'string' && json.code.startsWith('2')

    return {
      verified,
      transRef: json.data?.transRef ?? null,
      amount: typeof json.data?.amount === 'number' ? json.data.amount : null,
      code: json.code ?? String(res.status),
      message: json.message ?? 'ไม่มีข้อความตอบกลับ',
      raw: json,
    }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return {
      verified: false, transRef: null, amount: null,
      code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: aborted ? 'ตรวจสลิปนานเกินไป' : 'ติดต่อระบบตรวจสลิปไม่ได้',
      raw: null,
    }
  } finally {
    clearTimeout(timer)
  }
}
