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

/**
 * รหัสที่ถือว่า "สลิปถูกต้องและผ่านทุกเงื่อนไข"
 *
 * ระวังกับดัก: Slip2Go ส่ง HTTP 200 กลับมาแทบทุกกรณี และรหัสความล้มเหลว
 * ก็ขึ้นต้นด้วย 2 เหมือนกัน เช่น
 *   200401 บัญชีผู้รับไม่ถูกต้อง   200402 ยอดโอนไม่ตรง
 *   200404 ไม่พบสลิปในระบบธนาคาร   200500 สลิปปลอม   200501 สลิปซ้ำ
 * ถ้าเช็คแค่ว่า "ขึ้นต้นด้วย 2" จะยืนยันเงินให้สลิปปลอมทันที
 * จึงต้องระบุรหัสที่ยอมรับแบบเจาะจงเท่านั้น
 */
const SUCCESS_CODES = new Set(['200000', '200200'])

/** แปลรหัสเป็นข้อความที่ลูกค้าและแอดมินอ่านรู้เรื่อง */
const CODE_MESSAGE: Record<string, string> = {
  '200401': 'สลิปนี้โอนเข้าบัญชีอื่น ไม่ใช่บัญชีของร้าน',
  '200402': 'ยอดโอนไม่ตรงกับยอดที่ต้องชำระ',
  '200403': 'วันที่โอนไม่ตรงเงื่อนไข',
  '200404': 'ไม่พบสลิปนี้ในระบบธนาคาร',
  '200500': 'สลิปไม่ถูกต้องหรือถูกดัดแปลง',
  '200501': 'สลิปนี้เคยถูกใช้ไปแล้ว',
  '200502': 'ระบบธนาคารขัดข้อง ลองใหม่อีกครั้ง',
  '400002': 'ไฟล์สลิปไม่ถูกต้อง',
  '400005': 'รูปสลิปไม่ถูกต้อง',
  '401001': 'กุญแจเชื่อมต่อไม่ถูกต้อง (ตรวจ SLIP2GO_SECRET)',
  '401004': 'แพ็กเกจ Slip2Go หมดอายุ',
  '401005': 'โควตาตรวจสลิปหมดแล้ว',
  '401006': 'เครดิต Slip2Go ไม่พอ',
  '401007': 'IP ไม่ได้รับอนุญาต',
  '429000': 'เรียกใช้ถี่เกินไป ลองใหม่อีกครั้ง',
  '500500': 'ระบบตรวจสลิปขัดข้อง',
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
  // trim เพราะการคัดลอกคีย์มาวางในหน้าตั้งค่ามักติดช่องว่างหรือขึ้นบรรทัดใหม่มาด้วย
  // ซึ่งทำให้ได้ 401001 Token Mismatch โดยที่คีย์ดูถูกต้องทุกตัวอักษร
  const secret = process.env.SLIP2GO_SECRET?.trim()
  const promptpayId = process.env.PROMPTPAY_ID?.trim()
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

    const code = json.code ?? String(res.status)
    const amount = typeof json.data?.amount === 'number' ? json.data.amount : null

    // ด่านที่ 1: รหัสต้องอยู่ในรายการที่ยอมรับเท่านั้น
    let verified = SUCCESS_CODES.has(code)

    // ด่านที่ 2: เทียบยอดเงินด้วยตัวเองอีกชั้น ไม่ฝากความถูกต้องของเงิน
    // ไว้กับการตีความรหัสของบริการภายนอกอย่างเดียว
    // ถ้าวันหนึ่งเขาเพิ่มรหัสใหม่หรือเปลี่ยนความหมาย เงินของเราต้องไม่หลุด
    if (verified && amount !== null) {
      const diff = Math.abs(amount - params.expectedAmount)
      if (diff > 0.005) {
        return {
          verified: false, transRef: json.data?.transRef ?? null, amount, code,
          message: `ยอดในสลิป ${amount.toFixed(2)} ไม่ตรงกับยอดที่ต้องชำระ ${params.expectedAmount.toFixed(2)}`,
          raw: json,
        }
      }
    } else if (verified && amount === null) {
      // ผ่านรหัสแต่ไม่มียอดให้ตรวจ = ตรวจซ้ำไม่ได้ ไม่ยืนยันอัตโนมัติ
      verified = false
    }

    return {
      verified,
      transRef: json.data?.transRef ?? null,
      amount,
      code,
      message: CODE_MESSAGE[code] ?? json.message ?? 'ไม่มีข้อความตอบกลับ',
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
