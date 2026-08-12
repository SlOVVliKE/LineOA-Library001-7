-- ทุกวิวใช้ security_invoker เพื่อให้ RLS ของตารางข้างใต้ยังทำงาน
-- ============================================================
-- 0009  วิวสำหรับรายงาน
-- ============================================================

-- กำไรรายออเดอร์ (แยกช่องทาง)
create or replace view public.v_order_profit
with (security_invoker = on) as
select
  o.id, o.order_no, o.created_at, o.paid_at, o.status,
  c.code as channel_code, c.name_th as channel_name,
  o.subtotal, o.discount, o.shipping_fee, o.total,
  o.cogs_total, o.shipping_actual_cost, o.channel_fee,
  o.gross_profit,
  case when (o.subtotal - o.discount) > 0
       then round(o.gross_profit / (o.subtotal - o.discount) * 100, 2) end as margin_pct
from public.orders o
join public.channels c on c.id = o.channel_id
where o.status in ('paid','packing','shipped','delivered','completed');

-- ยอดขายรายวัน
create or replace view public.v_daily_sales
with (security_invoker = on) as
select
  date_trunc('day', o.paid_at)::date as sale_date,
  c.code as channel_code,
  count(*)                as order_count,
  sum(o.total)            as revenue,
  sum(o.cogs_total)       as cogs,
  sum(o.gross_profit)     as gross_profit
from public.orders o
join public.channels c on c.id = o.channel_id
where o.paid_at is not null
  and o.status in ('paid','packing','shipped','delivered','completed')
group by 1, 2;

-- หนังสือขายดี + กำไรรายเล่ม
create or replace view public.v_book_performance
with (security_invoker = on) as
select
  b.id as book_id, b.sku, b.title, b.author,
  coalesce(sum(oi.qty), 0)                                  as qty_sold,
  coalesce(sum(oi.line_total), 0)                           as revenue,
  coalesce(sum(oi.qty * coalesce(oi.unit_cogs, 0)), 0)      as cogs,
  coalesce(sum(oi.line_total) - sum(oi.qty * coalesce(oi.unit_cogs,0)), 0) as gross_profit,
  max(o.paid_at)                                            as last_sold_at
from public.books b
left join public.order_items oi on oi.book_id = b.id
left join public.orders o on o.id = oi.order_id
  and o.status in ('paid','packing','shipped','delivered','completed')
group by b.id, b.sku, b.title, b.author;

-- สินค้าค้างสต็อก (ไม่ขยับเกิน 90 วัน)
--
-- นับจาก "วันที่ขายครั้งล่าสุด" ถ้าเคยขาย
-- ถ้าไม่เคยขายเลย ให้นับจาก "วันที่รับเข้าครั้งแรก"
-- ไม่งั้นหนังสือที่เพิ่งรับเข้าเมื่อวานจะถูกนับเป็นของค้างทันทีเพราะยังไม่เคยขาย
create or replace view public.v_dead_stock
with (security_invoker = on) as
select
  s.book_id, s.sku, s.title, s.on_hand, s.stock_value_at_cost,
  p.last_sold_at,
  l.first_received_at,
  current_date - coalesce(p.last_sold_at::date, l.first_received_at) as days_idle
from public.v_stock_summary s
join public.v_book_performance p on p.book_id = s.book_id
left join lateral (
  select min(pl.received_at) as first_received_at
  from public.purchase_lots pl
  where pl.book_id = s.book_id
) l on true
where s.on_hand > 0
  and coalesce(p.last_sold_at::date, l.first_received_at) < current_date - 90;

-- สินค้าที่ต้องสั่งเพิ่ม
create or replace view public.v_reorder_alerts
with (security_invoker = on) as
select s.book_id, s.sku, s.title, s.on_hand, s.available_to_sell, b.reorder_point
from public.v_stock_summary s
join public.books b on b.id = s.book_id
where b.is_active and s.on_hand <= b.reorder_point;

-- ส่วนต่างค่าส่ง: เก็บลูกค้าเท่าไหร่ vs จ่ายขนส่งจริงเท่าไหร่
create or replace view public.v_shipping_gap
with (security_invoker = on) as
select
  date_trunc('month', o.paid_at)::date as month,
  count(*)                                     as shipment_count,
  sum(o.shipping_fee)                          as collected,
  sum(coalesce(o.shipping_actual_cost, 0))     as paid_out,
  sum(o.shipping_fee - coalesce(o.shipping_actual_cost, 0)) as gap
from public.orders o
where o.paid_at is not null and o.status <> 'cancelled'
group by 1;
