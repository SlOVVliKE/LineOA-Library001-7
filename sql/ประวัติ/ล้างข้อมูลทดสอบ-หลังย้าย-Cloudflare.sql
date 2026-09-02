-- ============================================================
--  ล้างข้อมูลที่เกิดจากการทดสอบหลังย้ายมา Cloudflare (31 ส.ค. 2569)
--
--  วิธีใช้: รัน PART 1 ก่อนเสมอ เพื่อดูว่าจะลบอะไรบ้าง
--           พอใจแล้วค่อยรัน PART 2
--
--  PART 2 อยู่ใน BEGIN ... COMMIT ถ้ามีอะไรผิดพลาดกลางทาง
--  Postgres จะยกเลิกทั้งก้อน ไม่มีทางลบไปได้ครึ่งเดียว
--
--  รันที่ Supabase Dashboard -> SQL Editor
-- ============================================================


-- ============================================================
--  PART 1 — ดูก่อนว่าจะลบอะไร (ไม่แก้อะไรทั้งสิ้น)
-- ============================================================

-- 1.1 ออเดอร์ทดสอบที่จะถูกลบ
select 'ออเดอร์ที่จะลบ' as รายการ, o.order_no, o.status, o.total,
       o.created_at at time zone 'Asia/Bangkok' as เวลาไทย
from public.orders o
where o.id = '9a2b97d7-b9bb-4b46-8b2d-885ced4bf932';

-- 1.2 ของที่ผูกกับออเดอร์นั้น (ต้องลบก่อน เพราะ FK เป็น RESTRICT)
select 'ใบเสร็จ' as รายการ, r.receipt_no as รหัส from public.receipts r
where r.order_id = '9a2b97d7-b9bb-4b46-8b2d-885ced4bf932'
union all
select 'พัสดุ', s.tracking_no from public.shipments s
where s.order_id = '9a2b97d7-b9bb-4b46-8b2d-885ced4bf932'
union all
-- หมายเหตุ: ตาราง notifications ไม่มีคอลัมน์ order_id
-- เลขออเดอร์ถูกเก็บไว้ข้างใน JSON payload ต้องงัดออกมาด้วย ->>
select 'แจ้งเตือน', n.id::text from public.notifications n
where n.payload->>'order_id' = '9a2b97d7-b9bb-4b46-8b2d-885ced4bf932';

-- 1.3 ล็อตทดสอบที่จะถูกลบ
select 'ล็อตที่จะลบ' as รายการ, l.lot_no, l.qty_received, l.qty_remaining,
       l.landed_unit_cost, l.supplier
from public.purchase_lots l
where l.id = '6296ad97-39a4-406d-aaad-3771dff5ab2a';   -- LOT-CFTEST

-- 1.4 สต็อกก่อนล้าง — จำตัวเลขสามบรรทัดนี้ไว้เทียบทีหลัง
select b.sku, v.on_hand as คงเหลือ, v.avg_unit_cost as ต้นทุนเฉลี่ย
from public.v_stock_summary v join public.books b on b.id = v.book_id
where b.sku in ('BK-0006','BK-0008','TEST-0001')
order by b.sku;

-- 1.5 รายงานกำไรก่อนล้าง
select count(*) as จำนวนออเดอร์,
       sum(o.total) as ยอดขาย
from public.orders o
where o.status not in ('cancelled','pending_payment');


-- ============================================================
--  PART 2 — ล้างจริง  (คัดลอกตั้งแต่ BEGIN ถึง COMMIT ไปรัน)
-- ============================================================
/*
BEGIN;

-- ---------- ก) ออเดอร์ทดสอบ OD-2026-000004 ----------
-- ลำดับสำคัญ: receipts / shipments เป็น FK แบบ RESTRICT ต้องออกไปก่อน
-- ส่วน order_items / payments เป็น CASCADE จะตามไปเองตอนลบ orders

delete from public.notifications
where payload->>'order_id' = '9a2b97d7-b9bb-4b46-8b2d-885ced4bf932';

delete from public.receipts
where order_id = '9a2b97d7-b9bb-4b46-8b2d-885ced4bf932';

delete from public.shipments
where order_id = '9a2b97d7-b9bb-4b46-8b2d-885ced4bf932';

-- คืนของเข้าล็อตที่ถูกตัดไปตอนขาย (LOT-H เพื่อนบ้านชั้นสาม เล่ม 1)
-- ต้องทำก่อนลบ movement ไม่งั้นจะไม่รู้ว่าต้องคืนเท่าไหร่
update public.purchase_lots
set qty_remaining = qty_remaining + 1
where id = 'bfa0aa5d-8a87-4a52-a7d6-d3908b4ab61e';

delete from public.stock_movements
where id = 'ee8d26c7-d047-437e-9249-e9eecb6bef8a';   -- sale -1

delete from public.orders
where id = '9a2b97d7-b9bb-4b46-8b2d-885ced4bf932';


-- ---------- ข) ล็อตทดสอบ LOT-CFTEST ----------
-- ล็อตนี้ยังไม่ถูกขายเลย (qty_remaining = qty_received = 2) จึงลบได้ตรงๆ
-- ถ้าวันไหนล็อตถูกขายไปบางส่วนแล้ว ห้ามลบ ให้ใช้ "ปรับสต็อก" ติดลบแทน
-- เพื่อให้ประวัติยังเล่าเรื่องได้ครบ

delete from public.stock_movements
where id = 'c8da0c98-1d64-43c4-be00-616fc8a3fe51';   -- purchase +2

delete from public.purchase_lots
where id = '6296ad97-39a4-406d-aaad-3771dff5ab2a'
  and qty_remaining = qty_received;                   -- กันพลาด ถ้าถูกขายไปแล้วจะไม่ลบ


-- ---------- ค) การปรับสต็อกที่ผมทำตอนทดสอบ (+2 แล้ว -2) ----------
-- สองรายการนี้หักล้างกันอยู่แล้ว ยอดคงเหลือจึงไม่เปลี่ยน
-- ลบเพื่อไม่ให้รายการล็อตรก และให้ประวัติสะอาด

-- คืนของเข้า LOT-TEST ที่ถูกตัดไปตอนปรับ -2
update public.purchase_lots
set qty_remaining = qty_remaining + 2
where id = 'a104e5c2-f2d3-4596-abbd-960d14c5fc9b';   -- LOT-TEST

delete from public.stock_movements
where id in (
  '14b432c1-bea1-4e44-bd24-b3cd4a866f03',            -- adjust +2
  '891aeea0-a181-4b2b-9690-fec43d66f43e'             -- adjust -2
);

-- ล็อตศูนย์บาทที่เกิดจากการปรับ +2 ของผม
delete from public.purchase_lots
where id = 'f2d2209b-c9ef-4283-957f-deb44bfb914e';


COMMIT;
*/


-- ============================================================
--  PART 3 — ไม่บังคับ: ล้างการปรับสต็อกของคุณเองตอน 15:54 ด้วย
--
--  ตอนคุณทดสอบเมื่อ 15:54 น. มีการปรับ TEST-0001 +2 ที่ยังไม่ได้ปรับคืน
--  ทำให้ตอนนี้ TEST-0001 มี 5 เล่ม ทั้งที่ของจริงควรเป็น 3
--
--  ถ้าอยากให้กลับไปเป็น 3 ให้รันก้อนนี้เพิ่ม
--  ถ้าตั้งใจให้มี 5 อยู่แล้ว ข้ามไปได้เลย
-- ============================================================
/*
BEGIN;

delete from public.stock_movements
where id = '22c4caac-ec8e-4ba4-9660-3a3915dd940e';   -- adjust +2 ตอน 15:54

delete from public.purchase_lots
where id = '618d927f-b98a-4d40-bfb3-9dfeea4b24b3';

COMMIT;
*/


-- ============================================================
--  PART 4 — ตรวจหลังล้าง (รันหลัง PART 2 เสร็จ)
--  ค่าที่ควรได้ เขียนไว้ให้เทียบแล้ว
-- ============================================================
/*
-- ควรได้:  BK-0006 คงเหลือ 2 ต้นทุนเฉลี่ย 170.00
--          BK-0008 คงเหลือ 50 ต้นทุนเฉลี่ย 73.00
--          TEST-0001 คงเหลือ 5  (หรือ 3 ถ้ารัน PART 3 ด้วย)
select b.sku, v.on_hand as คงเหลือ, v.avg_unit_cost as ต้นทุนเฉลี่ย
from public.v_stock_summary v join public.books b on b.id = v.book_id
where b.sku in ('BK-0006','BK-0008','TEST-0001')
order by b.sku;

-- ควรได้: 3 ออเดอร์ ยอดขายรวม 1,286.00 (กลับไปเท่าก่อนทดสอบ)
select count(*) as จำนวนออเดอร์, sum(o.total) as ยอดขาย
from public.orders o
where o.status not in ('cancelled','pending_payment');

-- ควรได้: ไม่มีแถวเหลือเลย
select 'ยังมีของค้าง' as เตือน, m.id, m.type, m.qty
from public.stock_movements m
where m.id in (
  'ee8d26c7-d047-437e-9249-e9eecb6bef8a',
  'c8da0c98-1d64-43c4-be00-616fc8a3fe51',
  '14b432c1-bea1-4e44-bd24-b3cd4a866f03',
  '891aeea0-a181-4b2b-9690-fec43d66f43e'
);
*/
