# แผนย้าย LibraryForU ไป Cloudflare Workers

เอกสารนี้เขียนจากการ **ทดลอง build โค้ดชุดจริงบน Workers** ไม่ใช่จากการอ่านเอกสารอย่างเดียว
ตัวเลขทุกตัวข้างล่างวัดมาแล้ว

---

## สรุปสั้นที่สุด

**ย้ายได้ แต่ต้องจ่าย $5/เดือน และต้องแก้โค้ด 1 จุดที่ถ้าไม่แก้ หน้าจ่ายเงินจะพัง**

---

## ส่วนที่ 1 — สิ่งที่ทดลองแล้วผ่าน

ผมลอกโค้ดทั้งชุดไปติดตั้ง `@opennextjs/cloudflare` แล้วสั่ง build จริง

| สิ่งที่ทดสอบ | ผล | หมายเหตุ |
|---|---|---|
| `opennextjs-cloudflare build` | ผ่าน | ทั้ง 32 route คอมไพล์ครบ |
| ขนาด Worker หลัง gzip | **1,643 KiB** | เพดาน free 3 MB / paid 10 MB — เหลือที่เยอะ |
| เวลา startup ของ Worker | **59 ms CPU** | เพดาน 1,000 ms — ห่างมาก |
| Middleware | ผ่าน | 92.6 kB bundle ได้ |
| `createHmac` (ตรวจลายเซ็น LINE webhook) | ผ่าน | |
| `timingSafeEqual` | ผ่าน | |
| `Buffer.from(arrayBuffer)` (อัปโหลดสลิป) | ผ่าน | |
| `promptpay-qr` (สร้าง payload) | ผ่าน | |
| หน้า `/shop` รันบน workerd จริง | 200 OK | ~30-40 ms wall time ตอนอุ่นแล้ว |

**สองอย่างที่มักทำให้ย้ายไม่ได้ เว็บนี้ไม่มีเลย**

- ไม่ได้ใช้ `next/image` → ไม่ต้องตั้ง Images binding
- ไม่มี `export const runtime = 'edge'` ที่ไหน → ไม่ต้องไล่ลบ

---

## ส่วนที่ 2 — จุดที่พัง (เจอตอนทดสอบ ไม่ได้เดา)

### QR พร้อมเพย์จะสร้างไม่ได้

```
FAIL: You need to specify a canvas element
```

`QRCode.toDataURL()` บน Workers จะไปเข้าทางฝั่งเบราว์เซอร์ของไลบรารี ซึ่งต้องมี `<canvas>`
บน Workers ไม่มี canvas → พัง

**จุดนี้อันตรายเป็นพิเศษ** เพราะมันไม่พังตอน build มันพังตอนลูกค้ากดเข้าหน้าจ่ายเงิน
ถ้าย้ายแล้วไม่ได้ทดสอบหน้านี้ จะรู้ตัวตอนลูกค้าโทรมาบอกว่าจ่ายไม่ได้

### วิธีแก้ — เปลี่ยน 2 บรรทัดใน `src/lib/payment/promptpay.ts`

```ts
// เดิม
return QRCode.toDataURL(payload, { width: 512, margin: 1 })

// ใหม่ — SVG เป็น JavaScript ล้วน ไม่ต้องใช้ canvas
return QRCode.toString(payload, { type: 'svg', width: 512, margin: 1 })
```

ทดสอบบน Workers แล้วผ่าน และ**ได้ของที่ดีกว่าเดิม**

| | PNG data URL (ของเดิม) | SVG (ของใหม่) |
|---|---|---|
| ขนาด | ~15,000 bytes | **1,968 bytes** |
| ความคมตอนซูม | เบลอ | คมทุกระดับ |
| ใช้ได้บน Workers | ไม่ได้ | ได้ |

ต้องแก้ที่หน้าแสดงผลด้วย จาก `<img src={dataUrl}>` เป็นการฝัง SVG ตรงๆ
**ข้อดีคือแก้แล้วดีขึ้นทั้งบน Netlify เดิมและบน Cloudflare** ไม่ได้แก้เพื่อย้ายอย่างเดียว

---

## ส่วนที่ 3 — เรื่องเงิน ตรงไปตรงมา

### Workers ฟรี ใช้กับเว็บนี้ไม่ได้

เพดาน CPU ของแพ็กเกจฟรีคือ **10 มิลลิวินาทีต่อ 1 request**

หลักฐานว่าไม่พอ

- เอกสาร Cloudflare เขียนเองว่างานที่ทำ authentication หรือ server-side rendering **"typically use 10-20 ms"** — เว็บนี้ทำทั้งสองอย่างทุกหน้า
- ผมจับเวลาสร้าง QR บน workerd จริง ได้ **22 ms** — เกินเพดานฟรีสองเท่า

ถ้าฝืนใช้ฟรี ลูกค้าจะเจอ **Error 1102 Worker exceeded resource limits** เป็นระยะ ซึ่งแย่กว่าช้า 2 วินาทีมาก

### Workers Paid = $5/เดือน (~175 บาท)

ได้มา

- CPU 30 วินาทีต่อ request (เพิ่มได้ถึง 5 นาที)
- 10 ล้าน request/เดือน
- CPU 30 ล้านมิลลิวินาที/เดือน
- ไม่คิดค่า bandwidth
- Cron Trigger 250 ตัว
- **ไม่มี cold start** — Workers ใช้ V8 isolate เริ่มใน ~5ms ไม่ใช่ ~2 วินาทีแบบ Lambda

ร้านขนาดนี้จะไม่มีทางใช้เกิน quota ที่รวมมาในค่าสมัคร → **จ่าย $5 เท่านั้น ไม่มีบิลบานปลาย**

### เทียบราคา

| | ราคา/เดือน | cold start | รันใกล้ไทยไหม |
|---|---|---|---|
| Netlify ฟรี (ตอนนี้) | ฿0 | มี ~2 วิ | ไม่ (us-east-1) |
| **Cloudflare Workers Paid** | **~฿175** | **ไม่มี** | **ใช่** |
| Netlify Pro | ~฿670 | มี | ตั้ง region ได้ |
| Vercel Pro | ~฿700 | มี | ตั้ง region ได้ |

Cloudflare ถูกกว่า Netlify Pro/Vercel Pro **สี่เท่า** และเป็นเจ้าเดียวที่ตัด cold start ทิ้งได้จริง

---

## ส่วนที่ 4 — งานที่ต้องทำถ้าตัดสินใจย้าย

### ต้องทำ

1. **แก้ QR เป็น SVG** — ตามส่วนที่ 2 (แก้ 2 ไฟล์)
2. **ติดตั้ง adapter** — `npm i @opennextjs/cloudflare wrangler`
3. **สร้าง `wrangler.jsonc`** แทน `netlify.toml`
   ต้องมี `nodejs_compat` และ `global_fetch_strictly_public`
4. **ย้าย cron** — Netlify scheduled functions ใช้ไม่ได้
   ต้องเขียน `custom-worker.ts` ที่ห่อ handler เดิมแล้วเติม `scheduled()` เข้าไป
   (เป็นวิธีที่เอกสาร OpenNext แนะนำเอง ไม่ใช่ของแฮ็ก)
   ตั้ง cron ใน `wrangler.jsonc` แทน `netlify.toml`
5. **ย้าย env 15 ตัว** ไปเป็น Cloudflare secrets
   `APP_SECRET`, `CRON_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`,
   `LINE_LOGIN_CHANNEL_ID`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_LIFF_ID`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `PROMPTPAY_ID`,
   `SHOP_ACCOUNT_NAME_TH`, `SLIP2GO_ACCOUNT_TYPE`, `SLIP2GO_SECRET`,
   `SUPABASE_SERVICE_ROLE_KEY`
   **ทุกตัวคุณกรอกเอง ผมไม่แตะค่า** — ผมบอกได้แค่ว่าตัวไหนตั้งแล้วหรือยัง
6. **แก้ URL ปลายทางใน LINE Developers** — webhook กับ LIFF endpoint ต้องชี้โดเมนใหม่
7. **`public/_headers`** ใส่ cache header ให้ `/_next/static/*`

### ต้องทดสอบก่อนสับสวิตช์ (ห้ามข้าม)

- หน้าจ่ายเงิน — QR ขึ้นไหม สแกนด้วยแอปธนาคารจริงได้ไหม
- LINE webhook — ลายเซ็นผ่านไหม บอทตอบไหม
- LIFF login — เข้าจาก LINE จริงได้ไหม
- อัปโหลดสลิป — ไฟล์ขึ้น Supabase Storage ไหม
- Slip2Go — (หมดอายุแล้ว ข้ามได้)
- cron ทั้งสองตัว — สั่งรันมือแล้วทำงานไหม
- หลังบ้าน — รับของเข้า ปรับสต็อก ยืนยันจ่ายเงิน

### แผนถอยกลับ

เก็บ Netlify ไว้ก่อน อย่าเพิ่งลบ
ย้าย DNS ทีหลังสุด ถ้ามีปัญหาชี้กลับ Netlify ได้ใน 5 นาที

---

## ส่วนที่ 5 — สิ่งที่ผมยังไม่ได้พิสูจน์

ต้องบอกไว้ตรงนี้ ไม่งั้นจะดูมั่นใจเกินหลักฐานที่มี

1. **CPU ต่อ request ของจริง** — ผมวัดได้แค่ wall time บนเครื่อง sandbox ซึ่งไม่ใช่ CPU time จริงบน Cloudflare
   ตัวเลขจริงจะรู้ตอน deploy แล้วดู Workers Logs
2. **หน้า `/shop` ที่ล็อกอินแล้ว** — ที่ผมยิงทดสอบมันเด้ง CustomerGate เพราะไม่มี session
   หน้าที่ดึงหนังสือจริงจาก Supabase ยังไม่ได้วัด
3. **cron ผ่าน custom worker** — อ่านเอกสารแล้วว่าทำได้ แต่ยังไม่ได้เขียนจริง
4. **Slip2Go** — หมดอายุ ไม่ได้ทดสอบ ถ้ากลับมาใช้ต้องทดสอบใหม่

---

## ความเห็นของผม

**ถ้ายอมจ่าย ~175 บาท/เดือน → ย้ายคุ้ม** ได้ทั้งตัด cold start และรันใกล้ไทย
ในราคาที่ถูกกว่าทางเลือกอื่นสี่เท่า และแก้ปัญหาที่ต้นเหตุจริง

**ถ้าอยากอยู่ฟรีต่อ → อย่าย้าย** Workers ฟรีจะทำให้แย่ลง ไม่ใช่ดีขึ้น
ให้ทำแคชรายการหนังสือบน Netlify แทน งานชั่วโมงเดียว ได้ผลกับหน้าที่คนเปิดบ่อยสุด

**ไม่ว่าจะย้ายหรือไม่ → แก้ QR เป็น SVG เถอะ** เล็กลง 7 เท่า คมกว่า และไม่ผูกกับ canvas อีก

---

*เอกสารนี้อ้างอิง*
- Cloudflare Workers limits — https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Workers pricing — https://developers.cloudflare.com/workers/platform/pricing/
- OpenNext Cloudflare get started — https://opennext.js.org/cloudflare/get-started
- OpenNext custom worker (cron) — https://opennext.js.org/cloudflare/howtos/custom-worker
