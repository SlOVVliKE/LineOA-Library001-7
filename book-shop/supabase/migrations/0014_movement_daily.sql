-- ============================================================
-- 0014  ความเคลื่อนไหวสต็อกรายวัน (ไว้ดูว่าวันไหนพุ่ง วันไหนตก)
--
-- แยกให้เห็นว่าของ "เข้า" กับ "ออก" ในแต่ละวันมาจากไหน
-- เพราะสต็อกลดลงเพราะขายได้ กับลดลงเพราะของเสีย เป็นคนละเรื่องกันโดยสิ้นเชิง
-- ถ้ารวมเป็นตัวเลขเดียวจะอ่านสถานการณ์ผิด
-- ============================================================
--
-- เรื่องวันที่: ของ "รับเข้า" ใช้วันที่ของมาถึงจริง (purchase_lots.received_at)
-- ไม่ใช่เวลาที่กดบันทึก เพราะถ้าบันทึกย้อนหลังกราฟจะเพี้ยน
-- ส่วนการขายและการปรับสต็อก ใช้เวลาที่เกิดรายการจริง
create or replace view public.v_stock_movement_daily
with (security_invoker = on) as
select
  case when sm.type = 'purchase' and pl.received_at is not null
       then pl.received_at
       else sm.created_at::date end                              as day,
  sm.book_id,
  b.sku,
  b.title,
  coalesce(sum(sm.qty) filter (where sm.type = 'purchase'), 0)    as qty_received,
  coalesce(-sum(sm.qty) filter (where sm.type = 'sale'), 0)       as qty_sold,
  coalesce(-sum(sm.qty) filter (where sm.type = 'damage'), 0)     as qty_damaged,
  coalesce(sum(sm.qty) filter (where sm.type = 'return'), 0)      as qty_returned,
  coalesce(sum(sm.qty) filter (where sm.type in ('adjust','channel_correction')), 0)
                                                                 as qty_adjusted,
  sum(sm.qty)                                                    as qty_net,

  -- มูลค่าต้นทุนของที่รับเข้าและที่ขายออกในวันนั้น
  coalesce(sum(sm.qty * coalesce(sm.unit_cost, 0))
           filter (where sm.type = 'purchase'), 0)                as cost_in,
  coalesce(-sum(sm.qty * coalesce(sm.unit_cost, 0))
           filter (where sm.type = 'sale'), 0)                    as cogs_out
from public.stock_movements sm
join public.books b on b.id = sm.book_id
left join public.purchase_lots pl on pl.id = sm.lot_id
group by 1, sm.book_id, b.sku, b.title;

-- สรุปรวมทั้งร้านต่อวัน ใช้วาดกราฟบนหน้าสต็อก
create or replace view public.v_stock_movement_daily_total
with (security_invoker = on) as
select
  day,
  sum(qty_received) as qty_received,
  sum(qty_sold)     as qty_sold,
  sum(qty_damaged)  as qty_damaged,
  sum(qty_returned) as qty_returned,
  sum(qty_adjusted) as qty_adjusted,
  sum(qty_net)      as qty_net,
  sum(cost_in)      as cost_in,
  sum(cogs_out)     as cogs_out
from public.v_stock_movement_daily
group by day;

grant select on public.v_stock_movement_daily        to authenticated;
grant select on public.v_stock_movement_daily_total  to authenticated;
