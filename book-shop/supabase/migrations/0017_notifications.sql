-- ============================================================
-- 0017  กล่องแจ้งเตือน (outbox) สำหรับ LINE
--
-- ทำไมต้องมีตารางกลาง แทนที่จะยิง LINE API ตรงจากโค้ดแอป:
--   1. สถานะออเดอร์ถูกเปลี่ยนจากหลายที่ (ยืนยันเงิน, จ่ายของตามคิว, บันทึกพัสดุ)
--      ถ้าให้แต่ละที่เรียก push เอง จะมีวันที่ลืมสักที่แล้วลูกค้าไม่ได้รับแจ้ง
--   2. LINE API ล่มได้ ถ้ายิงสดแล้วพลาด ข้อความจะหายไปเลยโดยไม่มีใครรู้
--   3. push มีโควตา ต้องนับได้ว่าส่งไปกี่ข้อความ
--
-- วิธีนี้ trigger เป็นคนบันทึกว่า "ต้องแจ้ง" ตอนสถานะเปลี่ยนจริงในฐานข้อมูล
-- แล้ว cron ค่อยมาระบายคิว ส่งไม่สำเร็จก็ลองใหม่ได้ และเห็นประวัติทั้งหมด
-- ============================================================

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users(id) on delete cascade,
  line_user_id text,
  type         text not null,
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'queued'
               check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts     int  not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index idx_notifications_queue on public.notifications (status, created_at)
  where status = 'queued';
create index idx_notifications_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_owner_read on public.notifications
  for select using (
    user_id = public.fn_current_user_id() or public.fn_has_permission('order.read'));
create policy notifications_admin_all on public.notifications
  for all using (public.fn_has_permission('order.read'))
  with check (public.fn_has_permission('order.read'));

grant select, insert, update on public.notifications to authenticated, service_role;

-- ---------- ตัวช่วยเข้าคิว ----------
create or replace function public.fn_enqueue_notification(
  p_user_id uuid,
  p_type    text,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_line_id text;
  v_id      uuid;
begin
  select line_user_id into v_line_id from public.users where id = p_user_id;

  insert into public.notifications (user_id, line_user_id, type, payload, status)
  values (
    p_user_id, v_line_id, p_type, p_payload,
    -- ลูกค้าที่ยังไม่ได้ผูก LINE (เช่นบัญชีทดสอบ) ไม่ต้องพยายามส่ง
    case when v_line_id is null or v_line_id like 'devU%' then 'skipped' else 'queued' end
  )
  returning id into v_id;

  return v_id;
end $$;

-- ---------- trigger: สถานะออเดอร์เปลี่ยน = ต้องแจ้งลูกค้า ----------
create or replace function public.fn_notify_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type    text;
  v_track   text;
begin
  if new.status = old.status then return new; end if;
  if new.user_id is null then return new; end if;

  v_type := case new.status
    when 'paid'             then case when old.status = 'preorder_waiting'
                                      then 'preorder_arrived' else 'order_paid' end
    when 'preorder_waiting' then 'preorder_confirmed'
    when 'awaiting_balance' then 'awaiting_balance'
    when 'shipped'          then 'order_shipped'
    when 'delivered'        then 'order_delivered'
    when 'cancelled'        then 'order_cancelled'
    else null
  end;

  if v_type is null then return new; end if;

  if v_type = 'order_shipped' then
    select tracking_no into v_track from public.shipments
    where order_id = new.id order by created_at desc limit 1;
  end if;

  perform public.fn_enqueue_notification(
    new.user_id, v_type,
    jsonb_build_object(
      'order_id',    new.id,
      'order_no',    new.order_no,
      'total',       new.total,
      'balance_due', new.balance_due,
      'tracking_no', v_track,
      'order_type',  new.order_type
    ));

  return new;
end $$;

create trigger trg_notify_order_status
  after update of status on public.orders
  for each row execute function public.fn_notify_order_status();

-- ---------- วิวสรุปให้แอดมินดู ----------
create or replace view public.v_notification_log
with (security_invoker = on) as
select
  n.id, n.type, n.status, n.attempts, n.last_error,
  n.created_at, n.sent_at,
  u.display_name as customer_name,
  n.payload->>'order_no' as order_no
from public.notifications n
left join public.users u on u.id = n.user_id;

grant select on public.v_notification_log to authenticated;
