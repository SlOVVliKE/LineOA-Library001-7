# คู่มือย้าย LibraryForU ไป Cloudflare Workers

> ## ✅ ย้ายเสร็จแล้ว — เก็บไว้อ้างอิงเท่านั้น
>
> | | |
> |---|---|
> | เว็บจริง | `https://libraryforu.thirakan-weef64.workers.dev` |
> | Netlify | Disable project แล้ว (ไซต์ยังอยู่ กู้กลับได้) |
> | ไฟล์ Netlify ใน repo | ลบแล้ว — กู้จาก git history ได้ถ้าต้องการ |
> | LIFF | `2011334191-2F8gRIx0` ชี้มา Cloudflare |
> | Webhook | ชี้มา Cloudflare · Verify ผ่าน |
> | cron | ย้ายมา Cloudflare Cron Triggers แล้ว |
>
> เนื้อหาข้างล่างเขียนตอนกำลังย้าย จึงยังพูดถึง Netlify เหมือนยังใช้งานอยู่
> อ่านเป็นบันทึกว่าย้ายมาอย่างไรและตัดสินใจอะไรไว้บ้าง
>
> **ยังเหลือหนึ่งอย่างที่ยังไม่มีใครยืนยัน — QR พร้อมเพย์บนเครื่องจริง**
> ดูเช็คลิสต์ในขั้นที่ 7

ทำตามลำดับ อย่าข้าม โดยเฉพาะขั้นที่ 7 (ทดสอบ) และขั้นที่ 8 (ย้าย DNS ทีหลังสุด)

**Netlify ยังอยู่ตลอดทั้งกระบวนการ** ถ้ามีปัญหาชี้กลับได้ทันที

---

## สิ่งที่ผมทำให้แล้ว

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/payment/promptpay.ts` | เปลี่ยน QR จาก PNG (ต้องใช้ canvas) เป็น SVG |
| `src/app/shop/orders/[id]/page.tsx` | แสดง QR แบบ SVG + ด่านตรวจก่อนฝัง |
| `custom-worker.ts` | worker หลัก — ห่อ handler ของ OpenNext แล้วเติม cron |
| `wrangler.jsonc` | ตั้งค่า Worker + cron trigger สองตัว |
| `open-next.config.ts` | ตั้งค่า adapter |
| `public/_headers` | cache header ไฟล์นิ่ง (Netlify อ่านได้เหมือนกัน ไม่กระทบของเดิม) |
| `package.json` | เพิ่ม adapter + wrangler, เพิ่มสคริปต์ `cf:*`, **อัป Next 15.5.23 → 15.5.24** |
| `tsconfig.json` / `.gitignore` | กันไฟล์ build ของ Cloudflare ออกจาก typecheck และ git |

**เรื่องอัป Next ต้องอธิบายหน่อย** — ผมไม่ได้อยากอัปเอง แต่ `@opennextjs/cloudflare` เวอร์ชันปัจจุบัน
บังคับ peer เป็น `next >= 15.5.24` ตอนลองติดตั้งเลย ERESOLVE ทันที
15.5.24 เป็นตัวล่าสุดในสาย 15.5 ต่างจากเดิมแค่ patch เดียว

---

## ขั้นที่ 1 — ติดตั้งของใหม่ในเครื่อง

```cmd
cd book-shop
npm install
```

**ผมไม่ได้รัน `npm install` ในโฟลเดอร์ของคุณโดยตั้งใจ** เพราะแซนด์บ็อกซ์ของผมเป็น Linux
ถ้าติดตั้งจากฝั่งผม `node_modules` จะได้ไบนารีของ Linux (workerd, esbuild) ซึ่งใช้บน Windows ไม่ได้
ผมทดสอบทั้งหมดในสำเนาแยกแทน

## ขั้นที่ 2 — ตรวจว่าของเดิมยังดีอยู่

```cmd
npm run typecheck
npm run build
```

ต้องผ่านทั้งคู่ ถ้าไม่ผ่าน **หยุดตรงนี้** อย่าไปต่อ

## ขั้นที่ 3 — สมัคร Cloudflare + เปิด Workers Paid

1. สมัคร/ล็อกอิน https://dash.cloudflare.com
2. Workers & Pages → เปลี่ยนเป็น **Workers Paid ($5/เดือน)**

**ต้องเปิด Paid ก่อน deploy** แพ็กเกจฟรีจำกัด CPU 10 มิลลิวินาทีต่อ request
ซึ่งไม่พอกับ SSR + auth ของเว็บนี้ (เอกสาร Cloudflare เองบอกว่างานแบบนี้กิน 10-20 ms)
ถ้า deploy บนฟรี ลูกค้าจะเจอ Error 1102 เป็นระยะ

**การสมัครและใส่บัตรเป็นเรื่องที่คุณต้องทำเอง ผมไม่ยุ่งกับข้อมูลการเงิน**

## ขั้นที่ 4 — ล็อกอิน wrangler

```cmd
cd book-shop
npx wrangler login
```

จะเปิดเบราว์เซอร์ให้กดอนุญาต

## ขั้นที่ 5 — ใส่ค่า secret 14 ตัว

**ทุกตัวคุณกรอกเอง ผมไม่แตะค่าจริงและไม่เคยเห็นมัน**
ค่าเดิมทั้งหมดอยู่ที่ Netlify → Site settings → Environment variables

รันทีละบรรทัด แล้วมันจะถามค่าให้พิมพ์

```cmd
npx wrangler secret put APP_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_LOGIN_CHANNEL_ID
npx wrangler secret put NEXT_PUBLIC_APP_URL
npx wrangler secret put NEXT_PUBLIC_LIFF_ID
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put PROMPTPAY_ID
npx wrangler secret put SHOP_ACCOUNT_NAME_TH
npx wrangler secret put SLIP2GO_ACCOUNT_TYPE
npx wrangler secret put SLIP2GO_SECRET
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

**ข้อควรระวัง**

- `NEXT_PUBLIC_APP_URL` ตอนนี้ให้ใส่ URL ชั่วคราวของ Cloudflare ไปก่อน
  (`https://libraryforu.<ชื่อบัญชี>.workers.dev`) แล้วค่อยเปลี่ยนเป็นโดเมนจริงตอนขั้นที่ 8
- `SLIP2GO_SECRET` **ห้ามเปลี่ยนชื่อเป็น `NEXT_PUBLIC_`** เด็ดขาด
  ตัวไหนขึ้นต้นด้วย `NEXT_PUBLIC_` จะถูกฝังลงไฟล์ JS ที่ลูกค้าโหลดได้
- ตัวที่ขึ้นต้น `NEXT_PUBLIC_` **ต้องถูกต้องใน `.env.local` ตอน build ด้วย**
  ไม่ใช่แค่ตั้งเป็น secret เพราะ Next ฝังค่าพวกนี้ลงไปตอน build
  เนื่องจากเราสั่ง build จากเครื่องตัวเอง ค่าที่ถูกฝังจึงมาจาก `.env.local` ของคุณ
  **ตั้งทั้งสองที่ให้ตรงกัน** จะไม่มีทางพลาด

- จุดที่พลาดง่ายที่สุด: `NEXT_PUBLIC_APP_URL` ถูกใช้ใน `src/lib/line/flex.ts`
  เพื่อประกอบลิงก์ในข้อความ LINE ที่ส่งหาลูกค้า
  ถ้าตอน build ค่ายังเป็นโดเมน Netlify ปุ่มในข้อความ LINE จะพากลับไป Netlify
  ทั้งที่เว็บย้ายมา Cloudflare แล้ว

## ขั้นที่ 6 — ลองรันในเครื่องด้วย runtime จริงของ Cloudflare

```cmd
npm run cf:preview
```

คำสั่งนี้ build แล้วรันบน workerd ซึ่งเป็นเครื่องยนต์ตัวเดียวกับบน Cloudflare จริง
ต่างจาก `npm run dev` ที่รันบน Node — **ของที่พังบน Workers จะพังตรงนี้ ไม่ใช่ตอนลูกค้าใช้**

ถ้าอยากให้ preview เห็น secret ด้วย สร้างไฟล์ `book-shop/.dev.vars` (ไม่ขึ้น git แล้ว)
หน้าตาเหมือน `.env.local`

### ทดสอบ cron ตอนรันในเครื่อง

cron ไม่ทำงานเองตอน preview ต้องยิงมือ (เปิด cmd อีกหน้าต่าง)

```cmd
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled?cron=0+*+*+*+*"
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled?cron=20+3+*+*+*"
```

ดูผลในหน้าต่างที่รัน preview จะมีบรรทัดขึ้นต้นด้วย `[cron]`

**ถ้าได้ 401 `ไม่ได้รับอนุญาต` ถือว่าปกติ ไม่ใช่บั๊ก**

ตอน preview ความลับสองฝั่งมาคนละทาง
- route ฝั่ง Next อ่านจาก `.env.local`
- worker อ่านจาก binding ของ Cloudflare ซึ่งในเครื่องต้องมาจาก `.dev.vars`

และ **`.dev.vars` ห้ามใส่ความลับ** เพราะไฟล์นั้นอยู่ในโฟลเดอร์ที่ AI อ่านได้
(เคยรั่วมาแล้วสองรอบจนต้องหมุนคีย์ Supabase ใหม่ทั้งชุด)

**บนของจริงไม่มีปัญหานี้** `wrangler secret put CRON_SECRET` สร้าง binding ให้ Worker
`env.CRON_SECRET` ใน `scheduled()` คือ binding ตัวนั้นโดยตรง จึงมีค่าแน่นอน

### ถ้าอยากเห็น 200 ในเครื่องจริงๆ

ปิดการเช็คชั่วคราว — คอมเมนต์ `CRON_SECRET` ใน `.env.local` ออก แล้ว build ใหม่
route จะข้ามการตรวจเองเมื่อไม่เจอค่า ทดสอบเสร็จแล้วเอากลับเข้าไป

(ปลอดภัยเพราะ `.env.local` ใช้แค่ในเครื่อง ไม่กระทบ Netlify และ Cloudflare)

### ทางที่แนะนำมากกว่า

ข้ามการทดสอบ cron ในเครื่องไปเลย แล้วไปทดสอบของจริงหลัง deploy แทน
Dashboard → Worker → Settings → Trigger Events → กด Trigger
ตรงนั้นความลับครบทั้งสองฝั่ง เป็นการทดสอบที่ตรงกับสภาพใช้งานจริงมากกว่า

### ⚠️ อย่ากดปุ่ม `t` (start tunnel)

wrangler มีปุ่ม `[t]` ให้เปิด tunnel ออกอินเทอร์เน็ต **ในงานนี้ไม่ต้องใช้และไม่ควรใช้**

ตอน preview เครื่องคุณโหลด `SUPABASE_SERVICE_ROLE_KEY` เข้าไปในหน่วยความจำ
ซึ่งเป็นคีย์ที่ข้าม RLS ได้ทั้งฐานข้อมูล พอเปิด tunnel เว็บนี้จะเข้าถึงได้จากทั้งอินเทอร์เน็ต
ใครเจอ URL ก็ยิง endpoint ได้ — wrangler เองก็เตือนไว้ว่า "publicly accessible"

ทดสอบผ่าน `http://127.0.0.1:8787` อย่างเดียวพอ ถ้าอยากทดสอบ LINE จากมือถือจริง
ให้ deploy ขึ้น Cloudflare (ขั้นที่ 7) แล้วใช้ URL `.workers.dev` แทน ปลอดภัยกว่ามาก

## ขั้นที่ 7 — Deploy แล้วทดสอบให้ครบ (ห้ามข้าม)

```cmd
npm run cf:deploy
```

จะได้ URL ชั่วคราว `https://libraryforu.<ชื่อบัญชี>.workers.dev`
**ตอนนี้ลูกค้ายังใช้ Netlify อยู่ ไม่มีใครกระทบ**

### เช็คลิสต์ — ต้องผ่านทุกข้อก่อนไปขั้นที่ 8

- [ ] เปิดหน้าร้าน รายการหนังสือขึ้นครบ
- [ ] ค้นหา + ตัวกรองหมวด/พร้อมส่ง ทำงาน
- [ ] กดเข้าหน้าหนังสือ ใส่ตะกร้า แก้จำนวน ลบออก
- [ ] สั่งซื้อจนถึงหน้าจ่ายเงิน
- [ ] **QR พร้อมเพย์ขึ้นเป็นสี่เหลี่ยมจัตุรัส ไม่ใช่แนวนอนบี้ๆ**
- [ ] **สแกน QR ด้วยแอปธนาคารจริง ยอดต้องตรงถึงสตางค์**
- [ ] อัปโหลดสลิป ไฟล์ขึ้น Supabase Storage
- [ ] เข้าจาก LINE จริง (LIFF) ล็อกอินผ่าน
- [ ] ทักบอทใน LINE บอทตอบ
- [ ] หลังบ้าน: รับของเข้า / ปรับสต็อก / ยืนยันจ่ายเงิน / รายงาน
- [ ] cron: Dashboard → Worker → Settings → Trigger Events → กด Trigger ทั้งสองตัว ดูว่าไม่ error
- [ ] Dashboard → Worker → Metrics ดู **CPU time จริงต่อ request** ว่าเท่าไหร่

**ข้อ QR สำคัญที่สุด** เพราะเป็นจุดเดียวที่ผมเจอว่าพังจริงตอนทดสอบ และผมแก้ไปแล้ว
แต่ผมทดสอบได้แค่ว่าฟังก์ชันสร้าง SVG ทำงานบน workerd — **ยังไม่ได้เห็นมันขึ้นจอจริง**

**ก่อนทดสอบ LINE** ต้องไปแก้ที่ LINE Developers Console ชั่วคราว
ให้ชี้มาที่ URL ของ Cloudflare — หรือรอทำตอนขั้นที่ 8 แล้วทดสอบ LINE ทีเดียว

## ขั้นที่ 8 — ย้ายโดเมน (ทำเป็นขั้นสุดท้าย)

1. Cloudflare → Workers → เลือก worker → Settings → Domains & Routes → Add Custom Domain
2. เปลี่ยน `NEXT_PUBLIC_APP_URL` เป็นโดเมนจริง แล้ว deploy ใหม่
3. LINE Developers Console
   - Messaging API → Webhook URL → `https://<โดเมน>/api/line/webhook` → กด Verify
   - LINE Login → LIFF → Endpoint URL → `https://<โดเมน>/shop`
4. ทดสอบ LINE ซ้ำอีกรอบ (webhook + LIFF + บอท)

## ขั้นที่ 9 — เฝ้าดูหนึ่งสัปดาห์

ดู Dashboard → Worker → Metrics ทุกวัน

- **CPU Time** — ถ้าเกิน 30 วินาทีบ่อย มีอะไรผิดปกติ (ปกติควรอยู่หลักสิบมิลลิวินาที)
- **Errors → Invocation Statuses** — ต้องไม่มี `exceededCpu` หรือ `exceededMemory`
- **Cron Events** — ทั้งสองตัวต้องขึ้นเขียว

**อย่าเพิ่งลบ Netlify** รออย่างน้อยหนึ่งสัปดาห์ที่ไม่มีปัญหา

---

## ปิด Netlify — ต้อง Disable project ไม่ใช่แค่ Stop builds

⚠️ **จุดที่พลาดง่ายและอันตราย**

เอกสาร Netlify เขียนไว้ว่า *"Scheduled functions only run on their schedule for published deploys"*

แปลว่า **Stop builds ไม่ได้หยุด cron** — deploy ที่ publish ไว้แล้วยังอยู่
`cron-notifications` จะยิงทุกชั่วโมงต่อไป และ `cron-expire-reservations` ยิงทุกวัน
ทั้งคู่ต่อ **Supabase ตัวเดียวกับ Cloudflare**

ผลคือมีสองระบบไล่ล้างกล่องแจ้งเตือนเดียวกัน = ลูกค้าอาจได้ข้อความซ้ำ
และสองระบบชิงกันปลดจอง pre-order

**ต้องกด Disable project**

Netlify → Project configuration → General → Danger zone → **Disable project**

ไซต์จะออฟไลน์แต่ config ยังอยู่ครบ และเปิดกลับได้

## ถ้าต้องถอยกลับ

1. Netlify → เปิด project กลับ
2. แก้ Webhook URL กับ LIFF Endpoint ใน LINE Developers กลับเป็น URL ของ Netlify
3. **สำคัญ: ปิด cron ฝั่ง Cloudflare ก่อน** — ลบบล็อก `triggers.crons` ใน `wrangler.jsonc`
   แล้ว deploy ใหม่ ไม่งั้นจะกลับไปมีสอง cron ยิง Supabase เดียวกันเหมือนเดิม

## เมื่อมั่นใจแล้ว (หลังใช้งานจริงสัก 1-2 สัปดาห์)

ค่อยลบของที่ไม่ใช้ออกจาก repo

- `netlify.toml`
- `netlify/functions/cron-notifications.mjs`
- `netlify/functions/cron-expire-reservations.mjs`

อย่าเพิ่งลบตอนนี้ เก็บไว้เป็นทางถอยก่อน

โค้ดที่แก้ไปทั้งหมด (QR เป็น SVG, ไฟล์ config ของ Cloudflare) **รันบน Netlify ได้ปกติ**
ไม่ต้อง revert อะไร

---

## สิ่งที่ผมทดสอบมาแล้วจริง

รันในสำเนาแยกด้วย workerd ตัวเดียวกับที่ Cloudflare ใช้

| | ผล |
|---|---|
| `npx tsc --noEmit` | ผ่าน ไม่มี error |
| `opennextjs-cloudflare build` | ผ่าน ครบทุก route |
| ขนาดหลัง gzip | **1,631 KiB** (เพดาน paid 10 MB) |
| Worker startup | **59 ms** (เพดาน 1,000 ms) |
| `createHmac` / `timingSafeEqual` (ลายเซ็น LINE) | ผ่าน |
| `Buffer.from(arrayBuffer)` (อัปโหลดสลิป) | ผ่าน |
| สร้าง QR เป็น SVG | ผ่าน 1,943 bytes |
| cron `0 * * * *` → `/api/cron/send-notifications` | เรียกถูก route |
| cron `20 3 * * *` → `/api/cron/expire-reservations` | เรียกถูก route |
| cron ที่ไม่มีในตาราง | log เตือนแล้วจบ ไม่พัง |

## สิ่งที่ผมยังทดสอบไม่ได้ ต้องพึ่งคุณ

1. **QR ขึ้นจอจริงและสแกนได้** — ผมพิสูจน์ได้แค่ว่าฟังก์ชันสร้าง SVG สำเร็จ
2. **CPU time จริงบน Cloudflare** — วัดจากเครื่องตัวเองไม่ได้ ต้องดูหลัง deploy
3. **LINE ทุกอย่าง** — ต้องมี key จริงและเครื่องจริง
4. **หน้าที่ล็อกอินแล้วดึงข้อมูลจริงจาก Supabase** — สำเนาทดสอบต่อ Supabase ไม่ได้
5. **Slip2Go** — trial หมดอายุแล้ว

---

## สรุปคำสั่งที่ใช้บ่อย

```cmd
npm run cf:preview    :: build + รันในเครื่องด้วย runtime จริงของ Cloudflare
npm run cf:deploy     :: build + ขึ้น Cloudflare
npm run cf:size       :: ดูขนาด bundle หลัง gzip
npx wrangler tail     :: ดู log สดจากเว็บจริง
```
