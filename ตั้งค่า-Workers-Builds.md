# ตั้งค่าให้ push แล้วขึ้นเว็บเอง (Cloudflare Workers Builds)

## ทำไมต้องเปลี่ยนวิธี

เครื่องคุณมีนโยบาย **Device Guard / WDAC** ที่บล็อก `workerd.exe`

```
'...\node_modules\@cloudflare\workerd-windows-64\bin\workerd.exe'
was blocked by your organization's Device Guard policy.
```

`opennextjs-cloudflare deploy` ต้องเปิด workerd ขึ้นมาก่อนเสมอ (ไปเช็คแคช)
จึง **deploy จากเครื่องนี้ไม่ได้อีกแล้ว** และ `npm run cf:preview` ก็ใช้ไม่ได้ด้วยเหตุผลเดียวกัน

**ไม่แนะนำให้ปิดนโยบายนี้** มันคุมทั้งเครื่อง ไม่ใช่แค่โฟลเดอร์นี้

ทางออกคือให้ Cloudflare build และ deploy ให้บนเครื่องของเขา (Ubuntu 24.04)
ซึ่งเป็นแพลตฟอร์มที่ OpenNext รองรับเต็มที่ — จะไม่มี warning
"OpenNext is not fully compatible with Windows" อีก

**สิ่งที่ยังทำได้บนเครื่องนี้** — `npm run dev`, `npm run typecheck`, `npm run build`
และ `npx opennextjs-cloudflare build` ทั้งหมดไม่ต้องใช้ workerd

---

## ขั้นตอน

### 1. เชื่อม repo

Cloudflare Dashboard → **Workers & Pages** → เลือก Worker **`libraryforu`**
→ **Settings** → **Builds** → **Connect**

เลือก **GitHub** → อนุญาตให้ Cloudflare เข้าถึง repo → เลือก `SlOVVliKE/LineOA-Library001-7`

### 2. ตั้ง Build settings

| ช่อง | ค่า |
|---|---|
| Git branch | `main` |
| **Root directory** | **`book-shop`** |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` |

> **Root directory สำคัญที่สุด** โค้ดอยู่ในโฟลเดอร์ย่อย ไม่ได้อยู่รากของ repo
> ถ้าเว้นว่าง Cloudflare จะหา `package.json` ไม่เจอแล้ว build ล้มทันที
>
> และเอกสาร Cloudflare เตือนว่า **ชื่อ Worker ใน dashboard ต้องตรงกับ `name`
> ใน wrangler config ที่อยู่ใน root directory นั้น** ของเราตรงกันอยู่แล้ว —
> ทั้งคู่คือ `libraryforu`

### 3. ใส่ Build variables — ขั้นที่พลาดกันมากที่สุด

Settings → **Build** → **Build Variables and Secrets**

**ทำไมต้องมี ทั้งที่ตั้ง secret ไว้แล้ว**

`wrangler secret` คือค่าที่ Worker ใช้ **ตอนรัน** ส่วนตัวแปรที่ขึ้นต้นด้วย
`NEXT_PUBLIC_` ถูก Next.js **ฝังลงไฟล์ตอน build** ที่ผ่านมา build เกิดบนเครื่องคุณ
ซึ่งมี `.env.local` อยู่ แต่เครื่อง build ของ Cloudflare **ไม่มีไฟล์นั้น**

ถ้าไม่ใส่ ค่าพวกนี้จะกลายเป็น `undefined` ในโค้ดที่ลูกค้าโหลด
อาการคือเว็บ build ผ่าน deploy ผ่าน แต่ **ลูกค้าล็อกอินไม่ได้และหน้าร้านว่างเปล่า**
โดยไม่มี error อะไรบอกเลย

ใส่สี่ตัวนี้ (ทุกตัวเป็นค่าที่เปิดเผยได้อยู่แล้ว ไม่ใช่ความลับ)

```
NEXT_PUBLIC_SUPABASE_URL       = https://btpmbtojdioukyfchtqh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = (anon key จาก Supabase)
NEXT_PUBLIC_LIFF_ID            = 2011334191-2F8gRIx0
NEXT_PUBLIC_APP_URL            = https://libraryforu.thirakan-weef64.workers.dev
```

**ห้ามใส่** `SUPABASE_SERVICE_ROLE_KEY`, `LINE_CHANNEL_ACCESS_TOKEN`,
`LINE_CHANNEL_SECRET`, `APP_SECRET`, `CRON_SECRET`, `SLIP2GO_SECRET` ตรงนี้
สี่ตัวแรกข้างบนพอ ที่เหลือโค้ดอ่านตอนรันจาก secret ที่ตั้งไว้แล้ว
การเอาความลับมาไว้ในตัวแปร build คือเพิ่มที่ให้มันรั่วโดยไม่ได้อะไรกลับมา

### 4. ทดสอบ

push อะไรก็ได้ขึ้น `main` แล้วดูที่
Worker → **Deployments** → **View build history**

ถ้าเขียวและเว็บอัปเดต = เสร็จ

---

## หลังจากนี้เวลาจะแก้อะไร

ดับเบิลคลิก **`deploy-check-and-push.cmd`** เหมือนเดิม
สคริปต์เหลือ 3 ขั้น (ตรวจ → build → push) แล้ว Cloudflare จะ build กับ deploy ต่อเอง

**ต่างจากเดิมตรงที่เว็บจะยังไม่เปลี่ยนทันทีที่สคริปต์จบ** ต้องรอ build บน
Cloudflare อีกประมาณ 2-3 นาที ดูสถานะได้ที่ Deployments

---

## ถ้า build บน Cloudflare ล้ม

ดู log ที่ **View build history** → เลือก build ที่แดง

ที่เจอบ่อย

| อาการใน log | สาเหตุ |
|---|---|
| `package.json not found` | Root directory ไม่ได้ตั้งเป็น `book-shop` |
| `name does not match` | ชื่อ Worker ใน dashboard ไม่ตรงกับ `name` ใน `wrangler.jsonc` |
| build ผ่านแต่เว็บว่าง / ล็อกอินไม่ได้ | ลืมใส่ Build variables ในขั้นที่ 3 |
| `EBADENGINE` | Node เวอร์ชันไม่ตรง — เพิ่มไฟล์ `book-shop/.nvmrc` ใส่เลข `24` |
