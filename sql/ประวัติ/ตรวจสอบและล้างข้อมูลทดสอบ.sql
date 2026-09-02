-- ============================================================
--  ตรวจสอบผลการทดสอบ + ล้างขยะ ก่อนทดสอบฝั่งแอดมิน
--
--  รันทีละส่วน อ่านผลก่อนแล้วค่อยไปส่วนถัดไป
--  ส่วนที่ 1-3 = อ่านอย่างเดียว ไม่แก้อะไร
--  ส่วนที่ 4   = ล้างขยะ (แก้ข้อมูล)
-- ============================================================


-- ============================================================
--  ส่วนที่ 1 — ยืนยันว่าการตรวจสลิปอัตโนมัติทำงานครบวงจรจริง
--  ควรได้ ✅ ครบทั้ง 6 บรรทัด
-- ============================================================
with o as (
  select * from public.orders where order_no = 'OD-2026-000003'
), checks as (
  select 1 ord, 'สถานะออเดอร์เป็นชำระเงินแล้ว' รายการ,
         (select status from o) ค่าที่พบ,
         (select status from o) = 'paid' ผ่าน
  union all
  select 2, 'สลิปถูกยืนยันแบบอัตโนมัติ',
         (select verify_status from public.payments
           where order_id = (select id from o) and verify_status = 'auto_verified' limit 1),
         exists (select 1 from public.payments
                  where order_id = (select id from o) and verify_status = 'auto_verified')
  union all
  select 3, 'เก็บรหัสธุรกรรมจากธนาคารไว้กันสลิปซ้ำ',
         coalesce((select slip_ref from public.payments
                    where order_id = (select id from o) and slip_ref is not null limit 1),
                  'ไม่มี'),
         exists (select 1 from public.payments
                  where order_id = (select id from o) and slip_ref is not null)
  union all
  select 4, 'ออกใบเสร็จแล้ว',
         coalesce((select receipt_no from public.receipts
                    where order_id = (select id from o) limit 1), 'ยังไม่ออก'),
         exists (select 1 from public.receipts where order_id = (select id from o))
  union all
  select 5, 'ล็อกต้นทุนลงรายการสินค้าแล้ว (COGS)',
         coalesce((select sum(unit_cogs * qty)::text from public.order_items
                    where order_id = (select id from o)), 'ไม่มี'),
         exists (select 1 from public.order_items
                  where order_id = (select id from o) and unit_cogs is not null)
  union all
  select 6, 'ตัดสต็อกสินค้าทดสอบแล้ว (เหลือ 4 จาก 5)',
         coalesce((select available_to_sell::text from public.v_public_stock vs
                    join public.books b on b.id = vs.book_id where b.sku = 'TEST-0001'), 'ไม่พบ'),
         coalesce((select available_to_sell from public.v_public_stock vs
                    join public.books b on b.id = vs.book_id where b.sku = 'TEST-0001'), -1) = 4
)
select case when ผ่าน then '✅' else '❌' end สถานะ, รายการ, ค่าที่พบ
from checks order by ord;


-- ============================================================
--  ส่วนที่ 2 — ออเดอร์ทั้งหมดในระบบตอนนี้
-- ============================================================
select o.order_no,
       o.status,
       o.order_type,
       o.total,
       count(p.id) filter (where p.verify_status = 'pending')       สลิปรอตรวจ,
       count(p.id) filter (where p.verify_status = 'auto_verified') ยืนยันอัตโนมัติ,
       o.created_at::timestamp(0)                                   สั่งเมื่อ
from public.orders o
left join public.payments p on p.order_id = o.id
group by o.id, o.order_no, o.status, o.order_type, o.total, o.created_at
order by o.order_no;


-- ============================================================
--  ส่วนที่ 3 — สต็อกที่ถูกจองค้างไว้
--  การจองหมดอายุใน 30 นาทีและทุกหน้ากรอง expires_at > now() อยู่แล้ว
--  แถวที่หมดอายุจึงไม่ทำให้ตัวเลขผิด แค่รกตาราง
-- ============================================================
select b.sku, b.title, sr.qty, sr.expires_at::timestamp(0),
       case when sr.expires_at > now() then 'ยังจองอยู่' else 'หมดอายุแล้ว' end สถานะ
from public.stock_reservations sr
join public.books b on b.id = sr.book_id
order by sr.expires_at;


-- ============================================================
--  ส่วนที่ 4 — ล้างขยะ (แก้ข้อมูลจริง)
-- ============================================================

-- 4.1 ลบสลิปที่อัปโหลดซ้ำระหว่างไล่แก้บั๊ก
--     เก็บเฉพาะใบที่ยืนยันสำเร็จไว้ ส่วนใบที่ค้าง pending ของออเดอร์เดียวกันลบทิ้ง
--     ถ้าไม่ลบ หน้าแอดมินจะขึ้นว่ามีสลิปรอตรวจทั้งที่จ่ายเงินไปแล้ว
delete from public.payments p
where p.verify_status = 'pending'
  and exists (
    select 1 from public.payments q
    where q.order_id = p.order_id
      and q.verify_status in ('auto_verified', 'manual_verified')
  );

-- 4.2 ล้างการจองที่หมดอายุแล้ว
select public.fn_expire_reservations();

-- 4.3 ซ่อนสินค้าทดสอบ 1 บาทไม่ให้ลูกค้าเห็น
--     ไม่ลบทิ้ง เพราะออเดอร์ที่จ่ายเงินแล้วอ้างถึงอยู่ ลบแล้วประวัติจะขาด
update public.books set is_active = false where sku = 'TEST-0001';


-- ============================================================
--  ตรวจผลหลังล้าง
-- ============================================================
select o.order_no, o.status, o.total,
       count(p.id) filter (where p.verify_status = 'pending') สลิปรอตรวจ
from public.orders o
left join public.payments p on p.order_id = o.id
group by o.id, o.order_no, o.status, o.total
order by o.order_no;
