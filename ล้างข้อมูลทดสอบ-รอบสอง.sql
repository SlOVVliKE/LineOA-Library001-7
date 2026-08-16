-- ============================================================
--  ล้างข้อมูลทดสอบที่สร้างระหว่างไล่กดทดสอบฝั่งแอดมิน
--
--  รันหลังจากทดสอบ pre-order ครบวงจรเสร็จแล้วเท่านั้น
--  ถ้ารันก่อน จะไม่มีของให้จ่ายคิว OD-2026-000002
--
--  ส่วนที่ 1 = อ่านอย่างเดียว  ส่วนที่ 2 = แก้ข้อมูลจริง
-- ============================================================


-- ============================================================
--  ส่วนที่ 1 — ดูก่อนว่ามีอะไรค้างอยู่บ้าง
-- ============================================================
select 'ล็อตทดสอบ' ประเภท, pl.lot_no ชื่อ, b.sku, pl.qty_received รับเข้า, pl.qty_remaining เหลือ
from public.purchase_lots pl
join public.books b on b.id = pl.book_id
where pl.lot_no in ('LOT-TESTRECV', 'LOT-TEST')

union all

select 'หนังสือทดสอบ', b.title, b.sku, null, null
from public.books b
where b.sku like 'TEST-%';

-- ความเคลื่อนไหวที่เกิดจากการทดสอบวันนี้
select sm.created_at::timestamp(0) เมื่อ, b.sku, sm.type ประเภท, sm.qty จำนวน, sm.reason เหตุผล
from public.stock_movements sm
join public.books b on b.id = sm.book_id
where sm.reason ilike '%ทดสอบ%'
order by sm.created_at desc;


-- ============================================================
--  ส่วนที่ 2 — ล้างจริง
-- ============================================================

-- 2.1 ปิดการขายหนังสือทดสอบ ไม่ให้ลูกค้าเห็นที่หน้าร้าน
--     ใช้ปิดแทนลบ เพราะออเดอร์ทดสอบอ้างถึงอยู่ ลบแล้วประวัติจะขาด
--     หลัง deploy รอบนี้จะกดปิดจากหน้าเว็บได้เลย ไม่ต้องมารัน SQL อีก
update public.books set is_active = false where sku like 'TEST-%';

-- 2.2 ลบหนังสือทดสอบที่ไม่เคยถูกสั่งซื้อและไม่เคยมีของเข้า
--     เงื่อนไขสามข้อนี้กันไม่ให้เผลอลบของที่มีประวัติผูกอยู่
delete from public.books b
where b.sku = 'TEST-0002'
  and not exists (select 1 from public.order_items oi where oi.book_id = b.id)
  and not exists (select 1 from public.purchase_lots pl where pl.book_id = b.id)
  and not exists (select 1 from public.stock_movements sm where sm.book_id = b.id);

-- 2.3 ล้างการจองที่หมดอายุ
select public.fn_expire_reservations();


-- ============================================================
--  ตรวจผลหลังล้าง — TEST-0002 ควรหายไป TEST-0001 ควรเหลือแต่ปิดขาย
-- ============================================================
select b.sku, b.title, b.is_active เปิดขาย,
       coalesce((select sum(pl.qty_remaining) from public.purchase_lots pl
                  where pl.book_id = b.id), 0) คงเหลือ
from public.books b
order by b.sku;
