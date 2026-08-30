# วิธีเช็ค Supabase Cloud ว่าพร้อมใช้งานจริงหรือยัง

ใช้เวลาประมาณ 5 นาที · ทำที่ <https://supabase.com/dashboard> → เลือกโปรเจกต์ → เมนู **SQL Editor** ทางซ้าย

---

## ขั้นตอนเดียว: คัดลอกทั้งก้อนนี้ไปวางแล้วกด Run

จะได้ตาราง 10 บรรทัด บอกว่าผ่าน (`✅`) หรือไม่ผ่าน (`❌`) ทีละข้อ

```sql
with checks as (

  select 1 as ord, 'migration ครบ 17 ไฟล์' as รายการ,
         count(*)::text || ' ไฟล์' as ค่าที่พบ,
         (count(*) >= 17) as ผ่าน
  from supabase_migrations.schema_migrations

  union all
  select 2, 'ตารางหลักครบ',
         count(*)::text || ' / 8 ตาราง',
         count(*) = 8
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('users','books','purchase_lots','orders',
                       'order_items','payments','receipts','notifications')

  union all
  select 3, 'ฟังก์ชันหลักครบ',
         count(*)::text || ' / 5 ฟังก์ชัน',
         count(*) = 5
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('fn_consume_stock_fifo','fn_create_orders_from_cart',
                      'fn_fulfill_preorders','fn_confirm_order_paid','fn_me')

  union all
  select 4, 'trigger แจ้งเตือนติดตั้งแล้ว',
         coalesce(count(*)::text, '0') || ' trigger',
         count(*) = 1
  from pg_trigger
  where tgname = 'trg_notify_order_status' and not tgisinternal

  union all
  select 5, 'RLS เปิดครบทุกตาราง',
         count(*) filter (where not c.relrowsecurity)::text || ' ตารางที่ยังไม่เปิด',
         count(*) filter (where not c.relrowsecurity) = 0
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'

  union all
  select 6, 'มีบัญชีเจ้าของร้าน',
         count(*)::text || ' คน',
         count(*) >= 1
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where r.code = 'owner'

  union all
  select 7, 'บัญชีแอดมินผูกกับ auth แล้ว',
         count(*)::text || ' บัญชี',
         count(*) >= 1
  from public.users
  where auth_user_id is not null and is_active

  union all
  select 8, 'มีหมวดหมู่หนังสือ',
         count(*)::text || ' หมวด',
         count(*) >= 1
  from public.categories

  union all
  select 9, 'มีหนังสือที่เปิดขาย',
         count(*)::text || ' เล่ม',
         count(*) >= 1
  from public.books where is_active

  union all
  select 10, 'ที่เก็บไฟล์ (slips ปิด / covers เปิด)',
         string_agg(id || '=' || case when public then 'public' else 'private' end, ', '
                    order by id),
         count(*) = 2
       and bool_and(case when id = 'slips' then not public else public end)
  from storage.buckets where id in ('slips','covers')
)
select case when ผ่าน then '✅' else '❌' end as สถานะ, รายการ, ค่าที่พบ
from checks order by ord;
```

---

## ถ้าข้อไหนขึ้น ❌ ให้ทำตามนี้

**ข้อ 1–5 ไม่ผ่าน → migration ยังขึ้นไม่ครบ**

เปิด PowerShell ที่โฟลเดอร์ `book-shop` แล้วรัน:

```
npx supabase login
npx supabase link --project-ref <Reference ID>
npx supabase db push
```

หา Reference ID ได้ที่ **Project Settings → General**
รันซ้ำได้ไม่เสียหาย — migration ที่ลงไปแล้วจะถูกข้าม

> ถ้าข้อ 4 ตัวเดียวที่ไม่ผ่าน แปลว่าไฟล์ `0017_notifications.sql` ยังไม่ขึ้น
> ระบบจะใช้งานได้ปกติ **แต่ลูกค้าจะไม่ได้รับแจ้งเตือนใด ๆ เลย** และไม่มี error ให้เห็นด้วย
> เพราะสถานะออเดอร์เปลี่ยนได้ตามปกติ แค่ไม่มีใครมาบันทึกลงคิวแจ้งเตือน

**ข้อ 6–7 ไม่ผ่าน → ยังไม่มีบัญชีเจ้าของร้าน**

ทำตามคู่มือขึ้นเซิร์ฟเวอร์ ขั้นที่ 2 ข้อ 4 (สร้าง user ใน Authentication ก่อน แล้วรัน `DO` block)

**ข้อ 8–9 ไม่ผ่าน → ยังไม่มีข้อมูลหนังสือ**

เป็นเรื่องปกติ ข้อมูลตัวอย่างตั้งใจไม่ให้ขึ้น cloud
เข้าหลังบ้านที่ `https://libraryforu.thirakan-weef64.workers.dev/admin` แล้วเพิ่มหมวดหมู่กับหนังสือจริงเอง

**ข้อ 10 ไม่ผ่าน → ที่เก็บไฟล์ยังไม่ถูกสร้าง**

มาจาก `0011_storage.sql` — แก้ด้วยการรัน `db push` เหมือนข้อ 1

> ถ้าขึ้นว่า `slips=public` **ต้องรีบแก้** เพราะสลิปโอนเงินของลูกค้าจะเปิดให้ใครก็เข้าดูได้
> แก้ที่ **Storage → slips → Configuration → ปิด Public bucket**

---

## เช็คเพิ่มอีก 2 อย่างที่ SQL ตอบให้ไม่ได้

**ค่า environment ที่ใช้จริง ชี้มาที่ cloud จริงไหม**

ไปที่ **Project Settings → API** ใน Supabase จด Project URL ไว้
แล้วเทียบกับ `NEXT_PUBLIC_SUPABASE_URL` **ทั้งสองที่**

```cmd
cd book-shop
npx wrangler secret list
```

ดูว่ามีชื่อครบ (คำสั่งนี้ไม่แสดงค่า) แล้วเทียบค่าจริงใน `.env.local` ของคุณเอง
ต้องตรงกันทั้งคู่ เพราะตัวที่ขึ้นต้น `NEXT_PUBLIC_` ถูกฝังตอน build จาก `.env.local`
ส่วน secret คือค่าที่ใช้ตอนรัน
ถ้ายังเป็น `http://127.0.0.1:54321` แปลว่าเว็บกำลังคุยกับฐานข้อมูลบนเครื่องคุณ ซึ่งเซิร์ฟเวอร์มองไม่เห็น

**หน้าร้านดึงข้อมูลได้จริงไหม**

เปิด `https://libraryforu.thirakan-weef64.workers.dev/shop` จากแอป LINE
ถ้าเห็นรายการหนังสือ = ทุกชั้นเชื่อมต่อกันครบแล้ว
ถ้าหน้าว่างทั้งที่ข้อ 9 ผ่าน ให้ดู **Logs → Postgres** ใน Supabase ว่ามี error อะไร
