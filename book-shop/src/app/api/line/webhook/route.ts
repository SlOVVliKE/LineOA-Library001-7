import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { replyMessage, isLineConfigured } from '@/lib/line/client'
import {
  greetingMessage, textMessage, bookCarousel, orderCard,
  type BookCardInput,
} from '@/lib/line/flex'
import { ORDER_STATUS_LABEL } from '@/lib/orderStatus'

export const dynamic = 'force-dynamic'

/**
 * Webhook ของ LINE
 *
 * ข้อแรกที่ต้องทำเสมอคือ **ตรวจลายเซ็น** — ไม่งั้นใครก็ยิง request ปลอมมาที่ URL นี้
 * แล้วสั่งให้ระบบทำอะไรก็ได้ในนามลูกค้าคนอื่น
 * URL นี้เปิดสาธารณะ ไม่มี auth อื่นมาป้องกัน ลายเซ็นคือด่านเดียว
 */
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret || !signature) return false

  const expected = createHmac('sha256', secret).update(body).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  // เทียบแบบเวลาคงที่ กัน timing attack
  return a.length === b.length && timingSafeEqual(a, b)
}

interface LineEvent {
  type: string
  replyToken?: string
  source?: { userId?: string; type?: string }
  message?: { type: string; text?: string }
}

export async function POST(request: Request) {
  const raw = await request.text()

  if (!verifySignature(raw, request.headers.get('x-line-signature'))) {
    return new Response('ลายเซ็นไม่ถูกต้อง', { status: 401 })
  }

  const body = JSON.parse(raw) as { events?: LineEvent[] }

  // ตอบ 200 ให้ LINE ก่อนเสมอ ถ้าช้าเกิน LINE จะถือว่า webhook เสียแล้วปิดทิ้ง
  const work = Promise.allSettled((body.events ?? []).map(handleEvent))
  await Promise.race([work, new Promise((r) => setTimeout(r, 8000))])

  return new Response('ok')
}

async function handleEvent(event: LineEvent) {
  const lineUserId = event.source?.userId
  const replyToken = event.replyToken
  if (!replyToken || !lineUserId) return

  if (event.type === 'follow') {
    const admin = createAdminClient()
    const { data: user } = await admin
      .from('users')
      .select('display_name')
      .eq('line_user_id', lineUserId)
      .maybeSingle()

    await replyMessage(replyToken, [greetingMessage((user?.display_name as string) ?? null)])
    return
  }

  if (event.type !== 'message' || event.message?.type !== 'text') return

  const text = (event.message.text ?? '').trim()
  const messages = await answer(text, lineUserId)
  if (messages.length > 0) await replyMessage(replyToken, messages)
}

/** ตรรกะบอท — ตอบด้วย reply เสมอ เพราะไม่นับโควตา */
async function answer(text: string, lineUserId: string) {
  const admin = createAdminClient()
  const lower = text.toLowerCase()

  // ---------- เช็คสถานะออเดอร์ ----------
  const orderNoMatch = text.match(/OD-\d{4}-\d+/i)
  if (orderNoMatch || /ออเดอร์|คำสั่งซื้อ|สถานะ|order/i.test(lower)) {
    const { data: user } = await admin
      .from('users').select('id').eq('line_user_id', lineUserId).maybeSingle()

    if (!user) {
      return [textMessage('ยังไม่พบบัญชีของคุณในระบบ — ลองกดเมนูเข้าร้านสักครั้งก่อนนะคะ')]
    }

    let q = admin
      .from('orders')
      .select('id, order_no, status, total, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)

    if (orderNoMatch) q = admin
      .from('orders')
      .select('id, order_no, status, total, created_at')
      .eq('order_no', orderNoMatch[0].toUpperCase())
      .eq('user_id', user.id)
      .limit(1)

    const { data: orders } = await q

    if (!orders?.length) {
      return [textMessage('ยังไม่พบคำสั่งซื้อค่ะ ลองสั่งซื้อจากเมนูด้านล่างได้เลย')]
    }

    return orders.map((o) =>
      orderCard({
        title: ORDER_STATUS_LABEL[o.status as string] ?? (o.status as string),
        subtitle: 'สถานะล่าสุดของคำสั่งซื้อ',
        orderNo: o.order_no as string,
        orderId: o.id as string,
        rows: [['ยอดรวม', '฿' + Number(o.total).toLocaleString('th-TH', { minimumFractionDigits: 2 })]],
      })
    )
  }

  // ---------- ค้นหาหนังสือ ----------
  const searchMatch = text.match(/^(?:ค้นหา|หา|search)\s+(.+)$/i)
  const keyword = searchMatch?.[1]?.trim()
  if (keyword && keyword.length >= 2) {
    const { data: books } = await admin
      .from('books')
      .select('id, title, author, sell_price, cover_url, stock_mode')
      .eq('is_active', true)
      .or(`title.ilike.%${keyword}%,author.ilike.%${keyword}%,isbn.ilike.%${keyword}%`)
      .limit(10)

    if (!books?.length) {
      return [textMessage(`ไม่พบหนังสือที่ตรงกับ "${keyword}" ค่ะ\nลองพิมพ์ชื่อผู้แต่งหรือคำอื่นดูนะคะ`)]
    }

    const { data: stock } = await admin.from('v_public_stock').select('book_id, available_to_sell')
    const stockMap = new Map((stock ?? []).map((s) => [s.book_id as string, Number(s.available_to_sell)]))

    const cards: BookCardInput[] = books.map((b) => ({
      id: b.id as string,
      title: b.title as string,
      author: (b.author as string) ?? null,
      price: Number(b.sell_price),
      coverUrl: (b.cover_url as string) ?? null,
      available: stockMap.get(b.id as string) ?? 0,
      isPreorder: b.stock_mode !== 'stock',
    }))

    return [textMessage(`พบ ${books.length} เล่มค่ะ`), bookCarousel(cards)]
  }

  // ---------- FAQ ----------
  if (/ค่าส่ง|จัดส่ง|ส่งฟรี/.test(lower)) {
    return [textMessage(
      'ค่าจัดส่ง 40 บาทต่อคำสั่งซื้อค่ะ\n' +
      'ซื้อครบ 500 บาท ส่งฟรี\n\n' +
      'ส่งด้วย Flash Express หรือ J&T เลือกได้ตอนสั่งซื้อ ถึงมือใน 2-3 วันทำการค่ะ'
    )]
  }
  if (/คืน|เปลี่ยน|ชำรุด/.test(lower)) {
    return [textMessage(
      'กรณีสินค้าชำรุด ส่งผิดเล่ม หรือมีตำหนิจากโรงพิมพ์ — เรารับคืนและออกค่าส่งคืนให้ค่ะ\n' +
      'กรณีเปลี่ยนใจ รับคืนภายใน 7 วันเฉพาะที่ยังไม่แกะซีล (ลูกค้าออกค่าส่งคืน)\n\n' +
      'ทักแจ้งแอดมินพร้อมรูปถ่ายได้เลยค่ะ'
    )]
  }
  if (/ชำระ|โอน|จ่าย|พร้อมเพย์|promptpay/.test(lower)) {
    return [textMessage(
      'ชำระได้ 2 ทางค่ะ\n' +
      '• สแกน PromptPay QR ที่หน้าคำสั่งซื้อ\n' +
      '• โอนเข้าบัญชีร้านแล้วแนบสลิป\n\n' +
      'กรุณาโอนยอดให้ตรงทุกสตางค์ เพราะเศษสตางค์คือรหัสประจำคำสั่งซื้อค่ะ'
    )]
  }
  if (/เวลา|เปิด|ปิด|ทำการ/.test(lower)) {
    return [textMessage('ร้านรับออเดอร์ตลอด 24 ชม. ผ่านเมนูด้านล่างค่ะ\nแอดมินตอบแชทและจัดส่ง จันทร์–เสาร์ 9:00–18:00 น.')]
  }

  // ---------- ไม่เข้าใจ ----------
  return [textMessage(
    'ขอโทษค่ะ ยังไม่เข้าใจคำถามนี้ 🙏\n\n' +
    'ลองพิมพ์แบบนี้ดูนะคะ\n' +
    '• "ค้นหา <ชื่อหนังสือ>"\n' +
    '• "ออเดอร์" — ดูคำสั่งซื้อล่าสุด\n' +
    '• "ค่าส่ง" / "การชำระเงิน" / "คืนสินค้า"\n\n' +
    'หรือรอสักครู่ แอดมินจะมาตอบเองค่ะ'
  )]
}

export async function GET() {
  return Response.json({
    ok: true,
    configured: isLineConfigured(),
    note: 'LINE จะเรียกด้วย POST เท่านั้น — GET นี้ไว้เช็คว่า deploy ติดแล้ว',
  })
}
