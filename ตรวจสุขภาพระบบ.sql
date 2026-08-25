-- ============================================================
--  ตรวจสุขภาพระบบ — รันได้ทุกเมื่อ ปลอดภัย ไม่แก้อะไรเลย
--
--  ใช้แทนไฟล์ตรวจย่อยๆ ที่กระจายอยู่หลายไฟล์
--  ควรรันหลัง migration ทุกครั้ง และก่อนเปิดร้านจริง
--
--  ทุกส่วนต้องได้ ✅ ถ้าเจอ ❌ ที่ไหนให้หยุดแล้วแก้ก่อน
-- ============================================================


-- ============================================================
--  1. ต้นทุนไม่รั่วออกหน้าร้าน
--     วิวสาธารณะสองตัวเป็น security definer โดยตั้งใจ (ดู 0022)
--     สิ่งที่ต้องยืนยันคือมันไม่ได้ปล่อยคอลัมน์ต้นทุนออกไป
-- ============================================================
select '1. ต้นทุนไม่รั่ว' หัวข้อ,
       case when count(*) = 0 then '✅ ไม่มีคอลัมน์ต้นทุนในวิวสาธารณะ'
            else '❌ พบ ' || count(*) || ' คอลัมน์: ' || string_agg(column_name, ', ')
       end ผล
from information_schema.columns
where table_schema = 'public'
  and table_name in ('v_public_stock', 'v_shop_books')
  and column_name ~* 'cost|supplier|invoice|margin|profit';


-- ============================================================
--  2. หนังสือที่ปิดการขายต้องไม่โผล่หน้าร้าน
-- ============================================================
select '2. ซ่อนหนังสือที่ปิดขาย' หัวข้อ,
       case when count(*) = 0 then '✅ ซ่อนครบ'
            else '❌ หลุดไปหน้าร้าน ' || count(*) || ' เล่ม'
       end ผล
from public.v_shop_books
where sku in (select sku from public.books where not is_active);


-- ============================================================
--  3. RLS เปิดครบทุกตาราง
--     ตารางไหนลืมเปิดคือใครก็อ่านได้หมดโดยไม่ผ่านเงื่อนไขเลย
-- ============================================================
select '3. RLS เปิดครบ' หัวข้อ,
       case when count(*) = 0 then '✅ ทุกตารางเปิด RLS'
            else '❌ ยังไม่เปิด: ' || string_agg(relname, ', ')
       end ผล
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;


-- ============================================================
--  4. ทุกตารางที่เปิด RLS ต้องมี policy อย่างน้อยหนึ่งตัว
--     เปิด RLS แต่ไม่มี policy = ไม่มีใครเข้าถึงได้เลยแม้แต่แอดมิน
-- ============================================================
select '4. มี policy ครบ' หัวข้อ,
       case when count(*) = 0 then '✅ ทุกตารางมี policy'
            else '❌ เปิด RLS แต่ไม่มี policy: ' || string_agg(relname, ', ')
       end ผล
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p
                  where p.schemaname = 'public' and p.tablename = c.relname);


-- ============================================================
--  5. policy ไม่ซ้อนกัน (ผลของ 0024)
--     ต้องกาง ALL ออกเป็น 4 คำสั่งก่อนนับ ไม่งั้นจะได้ 0 หลอกๆ เสมอ
-- ============================================================
with expanded as (
  select tablename,
         unnest(case when cmd = 'ALL'
                     then array['SELECT','INSERT','UPDATE','DELETE']
                     else array[cmd] end) as c
  from pg_policies where schemaname = 'public'
)
select '5. policy ไม่ซ้อนกัน' หัวข้อ,
       case when count(*) = 0 then '✅ ไม่มีคำสั่งไหนซ้อนกัน'
            else '⚠️ ยังซ้อน ' || count(*) || ' จุด (เรื่องความเร็ว ไม่ใช่ความปลอดภัย)'
       end ผล
from (select tablename, c from expanded group by tablename, c having count(*) > 1) d;


-- ============================================================
--  6. สต็อกในล็อตตรงกับที่ระบบบอกว่าคงเหลือ
--     ถ้าไม่ตรงแปลว่ามีการตัดสต็อกที่ไม่ผ่านฟังก์ชัน FIFO
-- ============================================================
select '6. สต็อกตรงกับล็อต' หัวข้อ,
       case when count(*) = 0 then '✅ ตรงทุกเล่ม'
            else '❌ ไม่ตรง ' || count(*) || ' เล่ม: ' || string_agg(sku, ', ')
       end ผล
from (
  select b.sku,
         coalesce((select sum(pl.qty_remaining) from public.purchase_lots pl
                    where pl.book_id = b.id), 0) ในล็อต,
         coalesce((select sum(sm.qty) from public.stock_movements sm
                    where sm.book_id = b.id), 0) จากความเคลื่อนไหว
  from public.books b
) t
where ในล็อต <> จากความเคลื่อนไหว;


-- ============================================================
--  7. ออเดอร์ที่จ่ายเงินแล้วต้องมีต้นทุนและใบเสร็จครบ
--     ยกเว้นสั่งจองที่ยังรอของเข้า ซึ่งยังไม่ถึงคิวตัดสต็อก
-- ============================================================
select '7. ออเดอร์ที่จ่ายแล้วครบถ้วน' หัวข้อ,
       case when count(*) = 0 then '✅ ครบทุกใบ'
            else '❌ ขาด: ' || string_agg(order_no || ' (' || ปัญหา || ')', ', ')
       end ผล
from (
  select o.order_no,
         case when o.cogs_total is null then 'ไม่มีต้นทุน'
              else 'ไม่มีใบเสร็จ' end ปัญหา
  from public.orders o
  where o.status in ('paid', 'packing', 'shipped', 'delivered', 'completed')
    and (o.cogs_total is null
      or not exists (select 1 from public.receipts r where r.order_id = o.id))
) t;


-- ============================================================
--  8. ไม่มีสลิปที่ยืนยันซ้ำในออเดอร์เดียวกัน
--     ด่านกันรับเงินซ้ำอยู่ในโค้ด ตรงนี้ยืนยันว่าไม่เคยหลุด
-- ============================================================
select '8. ไม่มีการรับเงินซ้ำ' หัวข้อ,
       case when count(*) = 0 then '✅ ไม่มีออเดอร์ไหนรับเงินก้อนเดียวกันซ้ำ'
            else '❌ พบ ' || count(*) || ' ออเดอร์: ' || string_agg(order_no, ', ')
       end ผล
from (
  select o.order_no
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.verify_status in ('auto_verified', 'manual_verified')
  group by o.order_no, (p.purpose = 'balance')
  having count(*) > 1
) t;


-- ============================================================
--  9. แจ้งเตือนที่ส่งไม่สำเร็จค้างอยู่
-- ============================================================
select '9. แจ้งเตือนไม่ค้าง' หัวข้อ,
       case when count(*) filter (where status = 'failed') = 0
            then '✅ ไม่มีที่ส่งไม่สำเร็จ (รอส่ง '
                 || count(*) filter (where status = 'queued') || ' รายการ)'
            else '⚠️ ส่งไม่สำเร็จ ' || count(*) filter (where status = 'failed') || ' รายการ'
       end ผล
from public.notifications;


-- ============================================================
--  10. การจองสต็อกที่หมดอายุค้างอยู่
--      ทุกหน้ากรอง expires_at > now() อยู่แล้ว แถวที่ค้างจึงไม่ทำให้ตัวเลขผิด
--      แค่รกตาราง ล้างได้ด้วย select public.fn_expire_reservations();
-- ============================================================
select '10. การจองไม่ค้าง' หัวข้อ,
       case when count(*) = 0 then '✅ ไม่มีการจองหมดอายุค้าง'
            else 'ℹ️ มี ' || count(*) || ' รายการ — ล้างด้วย fn_expire_reservations()'
       end ผล
from public.stock_reservations where expires_at <= now();
