/**
 * สร้าง Rich Menu 6 ช่อง แล้วตั้งเป็นเมนูเริ่มต้นของ LINE OA
 *
 * ใช้:  node scripts/setup-richmenu.mjs [path/to/richmenu.png]
 *
 * รูปต้องเป็น 2500x1686 px (หรือ 2500x843 สำหรับเมนูแถวเดียว)
 * ถ้าไม่ส่งรูปมา สคริปต์จะสร้างเมนูและบอกวิธีอัปโหลดรูปทีหลัง
 */
import { readFileSync, existsSync } from 'node:fs'

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID
const APP_URL = process.env.NEXT_PUBLIC_APP_URL

if (!TOKEN) {
  console.error('ไม่พบ LINE_CHANNEL_ACCESS_TOKEN — ใส่ใน .env.local ก่อน แล้วรันด้วย:')
  console.error('  node --env-file=.env.local scripts/setup-richmenu.mjs')
  process.exit(1)
}

const link = (path) =>
  LIFF_ID ? `https://liff.line.me/${LIFF_ID}${path}` : `${APP_URL ?? ''}${path}`

// พื้นที่ 2500x1686 แบ่ง 3 คอลัมน์ x 2 แถว
const W = 2500, H = 1686, CW = Math.floor(W / 3), CH = Math.floor(H / 2)
const cell = (col, row) => ({ x: col * CW, y: row * CH, width: CW, height: CH })

const richMenu = {
  size: { width: W, height: H },
  selected: true,
  name: 'เมนูหลักร้านหนังสือ',
  chatBarText: 'เมนูร้าน',
  areas: [
    { bounds: cell(0, 0), action: { type: 'uri', label: 'หนังสือทั้งหมด', uri: link('/shop') } },
    { bounds: cell(1, 0), action: { type: 'uri', label: 'มาใหม่', uri: link('/shop?sort=new') } },
    { bounds: cell(2, 0), action: { type: 'uri', label: 'เปิดจอง', uri: link('/shop?mode=preorder') } },
    { bounds: cell(0, 1), action: { type: 'uri', label: 'ตะกร้า', uri: link('/shop/cart') } },
    { bounds: cell(1, 1), action: { type: 'uri', label: 'ออเดอร์ของฉัน', uri: link('/shop/orders') } },
    { bounds: cell(2, 1), action: { type: 'message', label: 'ติดต่อแอดมิน', text: 'ขอคุยกับแอดมินค่ะ' } },
  ],
}

async function api(path, options = {}) {
  const res = await fetch(`https://api.line.me/v2/bot${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(options.body && !options.isBinary ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${await res.text()}`)
  return res.status === 200 && res.headers.get('content-type')?.includes('json')
    ? res.json() : null
}

async function main() {
  // ลบเมนูเก่าทิ้งก่อน กันเมนูซ้อนกันหลายอัน
  const existing = await api('/richmenu/list')
  for (const m of existing?.richmenus ?? []) {
    await api(`/richmenu/${m.richMenuId}`, { method: 'DELETE' })
    console.log('ลบเมนูเก่า:', m.richMenuId)
  }

  const created = await api('/richmenu', {
    method: 'POST',
    body: JSON.stringify(richMenu),
  })
  const id = created.richMenuId
  console.log('สร้างเมนูแล้ว:', id)

  const imagePath = process.argv[2]
  if (imagePath && existsSync(imagePath)) {
    const buf = readFileSync(imagePath)
    const res = await fetch(`https://api-data.line.me/v2/bot/richmenu/${id}/content`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': imagePath.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
      },
      body: buf,
    })
    if (!res.ok) throw new Error(`อัปโหลดรูปไม่สำเร็จ ${res.status}: ${await res.text()}`)
    console.log('อัปโหลดรูปเมนูแล้ว')

    await api(`/user/all/richmenu/${id}`, { method: 'POST' })
    console.log('ตั้งเป็นเมนูเริ่มต้นให้ทุกคนแล้ว')
  } else {
    console.log('')
    console.log('ยังไม่ได้ใส่รูปเมนู — LINE บังคับว่าต้องมีรูปก่อนถึงจะเปิดใช้ได้')
    console.log('ทำรูปขนาด 2500x1686 px แบ่ง 3 คอลัมน์ x 2 แถว ตามลำดับนี้:')
    console.log('  [หนังสือทั้งหมด] [มาใหม่]        [เปิดจอง]')
    console.log('  [ตะกร้า]         [ออเดอร์ของฉัน] [ติดต่อแอดมิน]')
    console.log('')
    console.log('แล้วรันซ้ำพร้อมพาธรูป:')
    console.log('  node --env-file=.env.local scripts/setup-richmenu.mjs richmenu.png')
  }
}

main().catch((e) => {
  console.error('ล้มเหลว:', e.message)
  process.exit(1)
})
