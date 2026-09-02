-- ============================================================
-- 0026  วิวนับงานค้างสำหรับหน้าแรกหลังบ้าน ("งานวันนี้")
--
-- ก่อนหน้านี้แต่ละหน้าหลังบ้านต้องนับงานค้างของตัวเองแยกกัน
-- ถ้าให้ layout เรียกทุกตัวเลขนี้ครั้งเดียวแล้วส่งต่อ จะยิง query เดียวจบ
-- ไม่ใช่ยิงซ้ำทุกหน้าที่โหลด (ดูเหตุผลเต็มในข้อ 5.2 ของ
-- เอกสาร/6-แผนรื้อ-UX-หลังบ้าน.md)
--
-- security_invoker = on เหมือนวิวอื่นทุกตัวในระบบ — ถ้าไม่ตั้ง ตัวเลขจะข้าม RLS
-- แล้วคนที่ไม่มีสิทธิ์ดูออเดอร์ (เช่น ฝ่ายสต็อกที่ไม่มี order.read) จะเห็นตัวเลข
-- ค้างของทั้งร้านผ่านหน้าแรกโดยไม่ต้องมีสิทธิ์อะไรเลย
-- ============================================================

create or replace view public.v_admin_work_queue
with (security_invoker = on) as
select
  (select count(*) from public.payments
     where verify_status = 'pending')                       as slips_pending,
  (select count(*) from public.orders
     where status = 'pending_payment')                      as orders_awaiting_payment,
  (select count(*) from public.orders
     where status in ('paid','packing'))                    as orders_to_ship,
  (select count(*) from public.orders
     where status = 'awaiting_balance')                     as orders_awaiting_balance,
  (select count(*) from public.preorder_queue
     where status in ('waiting','partially_filled'))        as preorders_waiting,
  (select count(*) from public.notifications
     where status = 'failed')                               as notifications_failed,
  (select count(*) from public.notifications
     where status = 'queued')                               as notifications_queued;

comment on view public.v_admin_work_queue is
  'ตัวเลขงานค้างทั้งหมดของหน้าแรกหลังบ้าน ("งานวันนี้") รวมเป็น query เดียว. '
  'security_invoker = on เพื่อให้ RLS ของ payments/orders/preorder_queue/notifications '
  'ยังคุมอยู่ — บัญชีที่ไม่มีสิทธิ์อ่านตารางไหนจะได้ 0 หรือ error จากตารางนั้น ไม่ใช่ตัวเลขจริง.';
