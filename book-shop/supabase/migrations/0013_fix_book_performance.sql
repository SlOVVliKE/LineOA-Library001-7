-- ============================================================
-- 0013  แก้บั๊ก: ออเดอร์ที่ยังไม่จ่ายเงินถูกนับเป็นยอดขาย
--
-- ของเดิมเขียนว่า
--   left join orders o on o.id = oi.order_id and o.status in ('paid', ...)
-- เงื่อนไขสถานะอยู่ใน ON ของ LEFT JOIN จึงไม่ได้กรองแถวทิ้ง
-- แค่ทำให้คอลัมน์ของ o เป็น null เฉยๆ แต่ sum(oi.qty) ยังนับแถวนั้นอยู่
-- ผลคือออเดอร์ที่ยังรอชำระเงินหรือถูกยกเลิก โผล่เป็นยอดขายทันที
--
-- แก้ด้วย filter (where o.id is not null) เพื่อให้นับเฉพาะแถวที่ join ติดจริง
-- ยังคงใช้ left join ไว้ เพื่อให้หนังสือที่ไม่เคยขายเลยยังปรากฏในรายงาน
-- ============================================================
create or replace view public.v_book_performance
with (security_invoker = on) as
select
  b.id as book_id, b.sku, b.title, b.author,
  coalesce(sum(oi.qty)        filter (where o.id is not null), 0) as qty_sold,
  coalesce(sum(oi.line_total) filter (where o.id is not null), 0) as revenue,
  coalesce(sum(oi.qty * coalesce(oi.unit_cogs, 0))
                              filter (where o.id is not null), 0) as cogs,
  coalesce(sum(oi.line_total - oi.qty * coalesce(oi.unit_cogs, 0))
                              filter (where o.id is not null), 0) as gross_profit,
  max(o.paid_at) as last_sold_at
from public.books b
left join public.order_items oi on oi.book_id = b.id
left join public.orders o on o.id = oi.order_id
  and o.status in ('paid', 'packing', 'shipped', 'delivered', 'completed')
group by b.id, b.sku, b.title, b.author;
