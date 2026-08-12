# LineOA-Library001-7

ระบบขายหนังสือออนไลน์ที่เชื่อมกับ LINE OA — ออกแบบให้เป็น **ศูนย์กลางสต็อก**
เพราะขายหลายช่องทาง (เว็บ+LINE OA, Shopee, Lazada, หน้าร้าน) แต่ของมีกองเดียว

## โครงสร้าง

| ที่ | คืออะไร |
|---|---|
| [`book-shop/`](./book-shop) | ซอร์สโค้ดทั้งหมด — Next.js 15 + Supabase · **เริ่มอ่านที่ [`book-shop/README.md`](./book-shop/README.md)** |
| [`แผนพัฒนาเว็บขายหนังสือ-LINE-OA.md`](./แผนพัฒนาเว็บขายหนังสือ-LINE-OA.md) | เอกสารแผนฉบับเต็ม — ขอบเขต, สถาปัตยกรรม, ข้อกฎหมาย, timeline, ค่าใช้จ่าย |

## เริ่มใช้งานเร็วสุด

ต้องมี [Node.js LTS](https://nodejs.org) และ [Docker Desktop](https://www.docker.com/products/docker-desktop) เปิดค้างไว้

```bash
cd book-shop
npm.cmd run setup:win   # Windows  (หรือดับเบิลคลิก scripts\setup-local.cmd)
npm run setup           # macOS / Linux
npm run dev
```

เปิด `http://localhost:3000/admin` — บัญชีทดสอบและรายละเอียดทั้งหมดอยู่ใน
[`book-shop/README.md`](./book-shop/README.md)

## สิ่งที่ทำงานได้แล้ว

- ต้นทุนรายล็อต + ตัดสต็อกแบบ **FIFO** ใน Postgres transaction
- สิทธิ์ผู้ใช้ 5 role คุมด้วย **RLS ที่ชั้นฐานข้อมูล** ไม่ใช่แค่ซ่อนปุ่ม
- หน้าร้าน → ตะกร้า → checkout → PromptPay/สลิป → ยืนยันเงิน → ออกใบเสร็จ
- **สั่งจองล่วงหน้า**: คิวใครก่อนได้ก่อน · จ่ายของอัตโนมัติเมื่อของเข้า · เติมต้นทุนย้อนหลัง
- รายงานกำไรแยกช่องทาง + ส่วนต่างค่าส่ง + export CSV

## ยังไม่ได้ทำ (รอ credential จากภายนอก)

ตรวจสลิปอัตโนมัติ · API ขนส่ง Flash/J&T · sync สต็อก Shopee/Lazada · Rich Menu + แจ้งเตือน LINE

---

> **หมายเหตุความปลอดภัย:** `.env.local` และ `supabase/.temp/` ถูก gitignore ไว้แล้ว
> ส่วนรหัสผ่านใน `book-shop/supabase/seed.sql` เป็นบัญชีทดสอบสำหรับฐานข้อมูลในเครื่องเท่านั้น
> ไฟล์นั้นไม่ถูกส่งขึ้น production (`supabase db push` ไม่รวม seed)
