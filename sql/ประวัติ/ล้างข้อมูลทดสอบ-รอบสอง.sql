-- ============================================================
--  ล้างข้อมูลทดสอบที่สร้างระหว่างไล่กดทดสอบฝั่งแอดมิน
--
--  ทดสอบครบทุก flow แล้ว รันไฟล์นี้ได้เลย
--  ส่วนที่ 1 = อ่านอย่างเดียว  ส่วนที่ 2 = แก้ข้อมูลจริง
--
--  หมายเหตุ: ออเดอร์ทดสอบทั้ง 3 ใบ (OD-2026-000001/2/3) ไม่ลบ
--  เพราะเป็นหลักฐานว่าระบบทำงานถูก และลบแล้วรายงานกำไรจะขาดช่วง
--  ถ้าอยากเริ่มนับยอดขายจริงจากศูนย์ ให้ใช้ส่วนที่ 3 (ปิดคอมเมนต์เอง)
-- ============================================================


-- ============================================================
--  ส่วนที่ 1 — ดูก่อนว่ามีอะไรค้างอยู่บ้าง
-- ============================================================
select b.sku, b.title, b.is_active เปิดขาย,
       coalesce((select sum(pl.qty_remaining) from public.purchase_lots pl
                  where pl.book_id = b.id), 0) คงเหลือ,
       exists (select 1 from public.order_items oi where oi.book_id = b.id) เคยถูกสั่งซื้อ
from public.books b
where b.sku like 'TEST-%';

-- ความเคลื่อนไหวที่เกิดจากการทดสอบวันนี้
select sm.created_at::timestamp(0) เมื่อ, b.sku, sm.type ประเภท, sm.qty จำนวน, sm.reason เหตุผล
from public.stock_movements sm
join public.books b on b.id = sm.book_id
where sm.reason ilike '%ทดสอบ%'
order by sm.created_at desc;

-- รายการรับเงินที่แอดมินกดเองโดยไม่มีสลิป (ควรมี 2 รายการจากการทดสอบ)
select o.order_no, p.purpose, p.amount, p.verify_payload->>'note' เหตุผล
from public.payments p
join public.orders o on o.id = p.order_id
where p.verify_payload->>'source' = 'manual_no_slip'
order by p.created_at;


-- ============================================================
--  ส่วนที่ 2 — ล้างจริง
-- ============================================================

-- 2.1 ปิดการขายหนังสือทดสอบ ไม่ให้ลูกค้าเห็นที่หน้าร้าน
--     ใช้ปิดแทนลบ เพราะออเดอร์ทดสอบอ้างถึงอยู่ ลบแล้วประวัติจะขาด
--     ตอนนี้กดปิดจากหน้าหนังสือในเว็บได้แล้ว ไม่ต้องมารัน SQL อีก
update public.books set is_active = false where sku like 'TEST-%';

-- 2.2 ลบหนังสือทดสอบที่ไม่เคยถูกสั่งซื้อและไม่เคยมีของเข้า
--     เงื่อนไขสามข้อกันไม่ให้เผลอลบของที่มีประวัติผูกอยู่
delete from public.books b
where b.sku = 'TEST-0002'
  and not exists (select 1 from public.order_items oi where oi.book_id = b.id)
  and not exists (select 1 from public.purchase_lots pl where pl.book_id = b.id)
  and not exists (select 1 from public.stock_movements sm where sm.book_id = b.id);

-- 2.3 ล้างการจองที่หมดอายุ
select public.fn_expire_reservations();


-- ============================================================
--  ส่วนที่ 3 — ล้างประวัติการขายทั้งหมด (ยังไม่เปิดใช้)
--
--  เอาคอมเมนต์ออกเฉพาะตอนจะเปิดร้านจริงและอยากให้รายงานเริ่มจากศูนย์
--  ทำแล้วย้อนกลับไม่ได้ ยอดขาย กำไร ใบเสร็จ จะหายหมด
--  ควรกด Backup ใน Supabase ก่อนทุกครั้ง
-- ============================================================
-- delete from public.receipts;
-- delete from public.shipments;
-- delete from public.payments;
-- delete from public.preorder_queue;
-- delete from public.order_items;
-- delete from public.orders;
-- alter sequence public.seq_order_no   restart with 1;
-- alter sequence public.seq_receipt_no restart with 1;


-- ============================================================
--  ตรวจผลหลังล้าง — TEST-0002 ควรหายไป TEST-0001 ควรเหลือแต่ปิดขาย
-- ============================================================
select b.sku, b.title, b.is_active เปิดขาย,
       coalesce((select sum(pl.qty_remaining) from public.purchase_lots pl
                  where pl.book_id = b.id), 0) คงเหลือ
from public.books b
order by b.sku;
