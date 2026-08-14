import type { LineMessage } from './client'

const TEAL = '#0F766E'
const AMBER = '#B45309'
const GREY = '#6B7280'

function baht(n: number): string {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function appUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return `${base}${path}`
}

/**
 * ลิงก์ที่เปิดในแอป LINE ถ้ามี LIFF ไม่งั้นเปิดเบราว์เซอร์ปกติ
 *
 * path นับจาก "รากของหน้าร้าน" เช่น '' , '/cart', '/orders/<id>'
 * ห้ามใส่ /shop นำหน้า เพราะ Endpoint URL ของ LIFF ตั้งเป็น .../shop อยู่แล้ว
 * และสิ่งที่ต่อท้าย LIFF URL จะถูกเอาไป "ต่อจาก" endpoint ไม่ใช่แทนที่
 *   liffUrl('/orders/x')  ->  https://liff.line.me/{id}/orders/x  ->  .../shop/orders/x
 * ถ้าใส่ '/shop/orders/x' จะกลายเป็น .../shop/shop/orders/x แล้วเจอ 404
 */
function liffUrl(path: string): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  return liffId ? `https://liff.line.me/${liffId}${path}` : appUrl(`/shop${path}`)
}

interface OrderCardInput {
  title: string
  subtitle: string
  orderNo: string
  orderId: string
  rows: [string, string][]
  accent?: string
  footerNote?: string
  buttonLabel?: string
}

export function orderCard(i: OrderCardInput): LineMessage {
  const accent = i.accent ?? TEAL
  return {
    type: 'flex',
    altText: `${i.title} · ${i.orderNo}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: accent,
        paddingAll: '16px',
        contents: [
          { type: 'text', text: i.title, color: '#FFFFFF', weight: 'bold', size: 'lg', wrap: true },
          { type: 'text', text: i.subtitle, color: '#FFFFFFCC', size: 'sm', wrap: true, margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text', text: i.orderNo, size: 'sm', color: GREY, weight: 'bold',
          },
          { type: 'separator', margin: 'md' },
          ...i.rows.map(([label, value]) => ({
            type: 'box' as const,
            layout: 'horizontal' as const,
            margin: 'md',
            contents: [
              { type: 'text', text: label, size: 'sm', color: GREY, flex: 3, wrap: true },
              { type: 'text', text: value, size: 'sm', flex: 4, align: 'end', wrap: true, weight: 'bold' },
            ],
          })),
          ...(i.footerNote
            ? [{ type: 'text' as const, text: i.footerNote, size: 'xs', color: GREY, wrap: true, margin: 'lg' }]
            : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: accent,
            height: 'sm',
            action: {
              type: 'uri',
              label: i.buttonLabel ?? 'ดูรายละเอียด',
              uri: liffUrl(`/orders/${i.orderId}`),
            },
          },
        ],
      },
    },
  }
}

// ---------- ข้อความตามเหตุการณ์ ----------

export function orderPaidMessage(p: {
  orderId: string; orderNo: string; total: number
}): LineMessage {
  return orderCard({
    title: 'ได้รับเงินแล้ว ขอบคุณค่ะ',
    subtitle: 'กำลังจัดเตรียมพัสดุให้',
    orderNo: p.orderNo,
    orderId: p.orderId,
    rows: [['ยอดชำระ', baht(p.total)]],
    footerNote: 'เมื่อจัดส่งแล้วจะแจ้งเลขพัสดุให้ทันที',
  })
}

export function preorderConfirmedMessage(p: {
  orderId: string; orderNo: string; total: number
}): LineMessage {
  return orderCard({
    title: 'รับการสั่งจองแล้ว',
    subtitle: 'จะแจ้งทันทีที่ของถึงร้าน',
    orderNo: p.orderNo,
    orderId: p.orderId,
    rows: [['ยอดชำระ', baht(p.total)]],
    accent: AMBER,
    footerNote: 'จัดส่งตามลำดับการจอง ใครจองก่อนได้ก่อน',
  })
}

export function preorderArrivedMessage(p: {
  orderId: string; orderNo: string
}): LineMessage {
  return orderCard({
    title: 'หนังสือที่คุณจองเข้าแล้ว',
    subtitle: 'เตรียมจัดส่งให้เลย',
    orderNo: p.orderNo,
    orderId: p.orderId,
    rows: [],
    footerNote: 'เราจะแจ้งเลขพัสดุอีกครั้งเมื่อส่งออก',
  })
}

export function awaitingBalanceMessage(p: {
  orderId: string; orderNo: string; balanceDue: number
}): LineMessage {
  return orderCard({
    title: 'ของเข้าแล้ว รอชำระส่วนที่เหลือ',
    subtitle: 'ชำระแล้วเราจะจัดส่งทันที',
    orderNo: p.orderNo,
    orderId: p.orderId,
    rows: [['ยอดคงเหลือ', baht(p.balanceDue)]],
    accent: AMBER,
    buttonLabel: 'ชำระส่วนที่เหลือ',
  })
}

export function orderShippedMessage(p: {
  orderId: string; orderNo: string; trackingNo: string | null
}): LineMessage {
  return orderCard({
    title: 'จัดส่งแล้ว',
    subtitle: 'พัสดุออกจากร้านเรียบร้อย',
    orderNo: p.orderNo,
    orderId: p.orderId,
    rows: p.trackingNo ? [['เลขพัสดุ', p.trackingNo]] : [],
    footerNote: p.trackingNo
      ? 'ใช้เลขนี้ติดตามพัสดุกับบริษัทขนส่งได้เลย'
      : 'ติดต่อแอดมินได้ถ้าต้องการเลขพัสดุ',
  })
}

export function orderDeliveredMessage(p: {
  orderId: string; orderNo: string
}): LineMessage {
  return orderCard({
    title: 'พัสดุถึงมือแล้ว',
    subtitle: 'ขอบคุณที่อุดหนุนร้านเรา',
    orderNo: p.orderNo,
    orderId: p.orderId,
    rows: [],
    footerNote: 'หากสินค้ามีปัญหา ทักมาได้เลยภายใน 7 วัน',
  })
}

export function orderCancelledMessage(p: {
  orderId: string; orderNo: string
}): LineMessage {
  return orderCard({
    title: 'คำสั่งซื้อถูกยกเลิก',
    subtitle: 'หากไม่ได้ตั้งใจ ทักหาแอดมินได้เลย',
    orderNo: p.orderNo,
    orderId: p.orderId,
    rows: [],
    accent: GREY,
  })
}

// ---------- การ์ดหนังสือ (ใช้ตอนลูกค้าค้นหา) ----------

export interface BookCardInput {
  id: string
  title: string
  author: string | null
  price: number
  coverUrl: string | null
  available: number
  isPreorder: boolean
}

export function bookCarousel(books: BookCardInput[]): LineMessage {
  return {
    type: 'flex',
    altText: `พบหนังสือ ${books.length} เล่ม`,
    contents: {
      type: 'carousel',
      contents: books.slice(0, 10).map((b) => ({
        type: 'bubble',
        size: 'kilo',
        ...(b.coverUrl
          ? { hero: { type: 'image', url: b.coverUrl, size: 'full', aspectRatio: '2:3', aspectMode: 'cover' } }
          : {}),
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            { type: 'text', text: b.title, weight: 'bold', size: 'sm', wrap: true, maxLines: 2 },
            { type: 'text', text: b.author ?? '—', size: 'xs', color: GREY, wrap: true },
            { type: 'text', text: baht(b.price), weight: 'bold', size: 'md', color: TEAL, margin: 'sm' },
            {
              type: 'text',
              text: b.isPreorder
                ? 'เปิดจอง'
                : b.available > 0
                  ? `พร้อมส่ง (เหลือ ${b.available})`
                  : 'สินค้าหมด',
              size: 'xs',
              color: b.isPreorder ? AMBER : b.available > 0 ? TEAL : GREY,
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: TEAL,
              height: 'sm',
              action: { type: 'uri', label: 'ดูรายละเอียด', uri: liffUrl(`/books/${b.id}`) },
            },
          ],
        },
      })),
    },
  }
}

/**
 * แจ้งลูกค้าที่ติดดาวไว้ว่าหนังสือกลับมามีของแล้ว
 *
 * ไม่ใช้ orderCard เพราะข้อความนี้ไม่มีเลขออเดอร์ และปุ่มต้องพาไปหน้าหนังสือ
 * ไม่ใช่หน้าออเดอร์
 */
export function bookBackInStockMessage(p: {
  bookId: string
  title: string
  price: number
}): LineMessage {
  return {
    type: 'flex',
    altText: `${p.title} กลับมามีของแล้ว`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: TEAL,
        paddingAll: '16px',
        contents: [
          {
            type: 'text', text: 'เล่มที่คุณสนใจกลับมาแล้ว',
            color: '#FFFFFF', weight: 'bold', size: 'lg', wrap: true,
          },
          {
            type: 'text', text: 'มีจำนวนจำกัด กดสั่งได้เลย',
            color: '#FFFFFFCC', size: 'sm', wrap: true, margin: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: p.title, weight: 'bold', size: 'md', wrap: true },
          { type: 'text', text: baht(p.price), size: 'md', color: TEAL, weight: 'bold', margin: 'sm' },
          {
            type: 'text',
            text: 'คุณกดดาวเล่มนี้ไว้ เราเลยแจ้งให้ทราบเมื่อของเข้า',
            size: 'xs', color: GREY, wrap: true, margin: 'lg',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: TEAL,
            height: 'sm',
            action: { type: 'uri', label: 'ดูหนังสือ', uri: liffUrl(`/books/${p.bookId}`) },
          },
        ],
      },
    },
  }
}

// ---------- เมนูร้านแบบการ์ด ----------

/** ปุ่มในเมนูร้าน ใช้ร่วมกันทั้งการ์ดและ quick reply จะได้ไม่หลุดกัน */
const SHOP_MENU: { label: string; path: string }[] = [
  { label: '📚 หนังสือทั้งหมด', path: '' },
  { label: '✨ มาใหม่',        path: '/?sort=new' },
  { label: '📅 เปิดจอง',        path: '/?mode=preorder' },
  { label: '⭐ รายการโปรด',     path: '/favourites' },
  { label: '🛒 ตะกร้า',         path: '/cart' },
  { label: '📦 ออเดอร์ของฉัน',  path: '/orders' },
]

/**
 * การ์ดเมนูร้าน — ทางเข้าสำรองแทนริชเมนู
 *
 * ริชเมนูกับ quick reply แสดงเฉพาะ LINE บนมือถือ (iOS/Android)
 * ลูกค้าที่ใช้ iPad หรือ LINE บน PC จะไม่เห็นเลย เข้าร้านไม่ได้
 * ปุ่มใน Flex Message เป็น "เนื้อหาของข้อความ" ไม่ใช่ UI ของแอป จึงแสดงได้ทุกเครื่อง
 */
export function shopMenuMessage(): LineMessage {
  return {
    type: 'flex',
    altText: 'เมนูร้านหนังสือ',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: TEAL,
        paddingAll: '16px',
        contents: [
          { type: 'text', text: 'เมนูร้านหนังสือ', color: '#FFFFFF', weight: 'bold', size: 'lg' },
          {
            type: 'text', text: 'กดปุ่มด้านล่างเพื่อเข้าร้านได้เลย',
            color: '#FFFFFFCC', size: 'sm', margin: 'sm', wrap: true,
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '12px',
        contents: SHOP_MENU.map((m) => ({
          type: 'button' as const,
          style: 'secondary' as const,
          height: 'sm' as const,
          action: { type: 'uri' as const, label: m.label, uri: liffUrl(m.path) },
        })),
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        contents: [
          {
            type: 'text',
            text: 'พิมพ์ "เมนู" เมื่อไรก็ได้เพื่อเรียกการ์ดนี้อีกครั้ง',
            size: 'xs', color: GREY, wrap: true, align: 'center',
          },
        ],
      },
    },
  }
}

/**
 * ปุ่มลัดใต้ช่องพิมพ์ (แสดงเฉพาะ LINE บนมือถือ)
 *
 * เอาไว้แปะกับข้อความตอบกลับ ให้คนใช้มือถือกดต่อได้เลยโดยไม่ต้องพิมพ์
 * บน PC/iPad จะไม่แสดง ซึ่งไม่เป็นไรเพราะมีการ์ดเมนูรองรับอยู่แล้ว
 */
export function withQuickMenu(message: LineMessage): LineMessage {
  return {
    ...message,
    quickReply: {
      items: [
        {
          type: 'action',
          action: { type: 'message', label: 'เมนูร้าน', text: 'เมนู' },
        },
        ...SHOP_MENU.slice(0, 5).map((m) => ({
          type: 'action' as const,
          action: { type: 'uri' as const, label: m.label.slice(0, 20), uri: liffUrl(m.path) },
        })),
      ],
    },
  }
}

export function textMessage(text: string): LineMessage {
  return { type: 'text', text }
}

export function greetingMessage(displayName: string | null): LineMessage {
  return {
    type: 'text',
    text:
      `สวัสดีค่ะ${displayName ? ' คุณ' + displayName : ''} 🙏\n\n` +
      'ยินดีต้อนรับสู่ร้านหนังสือของเรา\n' +
      'พิมพ์คุยกับเราได้เลย เช่น\n' +
      '• "ค้นหา สายลม" — หาหนังสือ\n' +
      '• "ออเดอร์" — ดูคำสั่งซื้อล่าสุด\n' +
      '• "ค่าส่ง" — ถามเรื่องค่าจัดส่ง\n' +
      '• "เมนู" — เรียกปุ่มเข้าร้าน\n\n' +
      'หรือกดเมนูด้านล่างเพื่อเข้าร้านได้เลยค่ะ',
  }
}
