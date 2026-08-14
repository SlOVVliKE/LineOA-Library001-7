-- ============================================================
-- 0018  ติดดาวหนังสือ (รายการโปรด)
--
-- ลูกค้ากดดาวไว้เมื่อสนใจแต่ยังไม่ซื้อ หรือของหมด
-- สองอย่างที่ได้จากตารางนี้:
--   1. ลูกค้ากลับมาดูของที่หมายตาไว้ได้ (ลดการซื้อหลุดมือ)
--   2. แอดมินเห็นว่าเล่มไหนมีคนรอเยอะ = สัญญาณว่าควรสั่งเข้าเล่มไหนก่อน
-- ============================================================

create table public.book_favourites (
  user_id     uuid not null references public.users(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  created_at  timestamptz not null default now(),

  -- เวลาที่แจ้งลูกค้าคนนี้ว่าเล่มนี้ของเข้าแล้ว
  -- เก็บไว้กันแจ้งซ้ำคนเดิมเล่มเดิม ซึ่งกินโควตา push ฟรีเดือนละ 300 ข้อความ
  -- และน่ารำคาญพอที่ลูกค้าจะบล็อก OA
  notified_at timestamptz,

  primary key (user_id, book_id)
);

-- ใช้ตอนนับยอดดาวรายเล่มในหลังบ้าน
create index idx_favourites_book on public.book_favourites (book_id);

alter table public.book_favourites enable row level security;

-- ลูกค้าจัดการดาวของตัวเองได้อย่างเดียว
-- แอดมินที่ดูออเดอร์ได้ก็อ่านได้ เพื่อใช้เป็นข้อมูลตัดสินใจสั่งของ
create policy favourites_owner on public.book_favourites
  for all
  using (user_id = public.fn_current_user_id() or public.fn_has_permission('order.read'))
  with check (user_id = public.fn_current_user_id());

grant select, insert, update, delete on public.book_favourites to authenticated;
grant select, insert, update, delete on public.book_favourites to service_role;

-- ---------- สรุปยอดดาวรายเล่มสำหรับหลังบ้าน ----------
-- security_invoker = on : PG15+ ไม่งั้น view จะข้าม RLS ของตารางข้างใต้
create or replace view public.v_favourite_demand
with (security_invoker = on) as
select
  b.id            as book_id,
  b.sku,
  b.title,
  b.author,
  b.stock_mode,
  b.is_active,
  count(f.user_id)                                        as fav_count,
  count(f.user_id) filter (where f.notified_at is null)    as waiting_count,
  max(f.created_at)                                       as last_starred_at,
  coalesce(vs.available_to_sell, 0)                       as available_to_sell
from public.books b
join public.book_favourites f on f.book_id = b.id
left join public.v_public_stock vs on vs.book_id = b.id
group by b.id, b.sku, b.title, b.author, b.stock_mode, b.is_active, vs.available_to_sell;

grant select on public.v_favourite_demand to authenticated;

-- ---------- แจ้งลูกค้าที่ติดดาวว่าเล่มนี้ของเข้าแล้ว ----------
-- แอดมินเป็นคนกดเรียก ไม่ใช่ trigger อัตโนมัติ เพราะโควตา push มีจำกัด
-- และการรับของเข้าครั้งเดียวอาจกระทบหลายสิบคนพร้อมกัน
create or replace function public.fn_notify_favourites(p_book_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_book  record;
  v_row   record;
  v_sent  int := 0;
begin
  if not public.fn_has_permission('book.write') then
    raise exception 'ไม่มีสิทธิ์แจ้งเตือนลูกค้า';
  end if;

  select id, title, sell_price into v_book from public.books where id = p_book_id;
  if v_book.id is null then
    raise exception 'ไม่พบหนังสือ';
  end if;

  -- แจ้งเฉพาะคนที่ยังไม่เคยได้รับแจ้งสำหรับเล่มนี้
  for v_row in
    select user_id from public.book_favourites
    where book_id = p_book_id and notified_at is null
  loop
    perform public.fn_enqueue_notification(
      v_row.user_id,
      'book_back_in_stock',
      jsonb_build_object(
        'book_id',   v_book.id,
        'title',     v_book.title,
        'price',     v_book.sell_price
      )
    );
    v_sent := v_sent + 1;
  end loop;

  update public.book_favourites
     set notified_at = now()
   where book_id = p_book_id and notified_at is null;

  return v_sent;
end $$;

revoke execute on function public.fn_notify_favourites(uuid) from public;
grant  execute on function public.fn_notify_favourites(uuid) to authenticated;

-- ---------- ปลดสถานะแจ้งเตือนเมื่อของหมดอีกครั้ง ----------
-- ถ้าไม่ล้าง notified_at ลูกค้าที่เคยได้รับแจ้งรอบก่อนจะไม่มีวันได้รับอีกเลย
-- แม้หนังสือจะหมดแล้วเข้าใหม่หลายรอบ
create or replace function public.fn_reset_favourite_notices(p_book_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.book_favourites
     set notified_at = null
   where book_id = p_book_id and notified_at is not null;
$$;

revoke execute on function public.fn_reset_favourite_notices(uuid) from public;
grant  execute on function public.fn_reset_favourite_notices(uuid) to authenticated, service_role;
