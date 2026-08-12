-- ============================================================
-- 0016  ระบบสั่งจองล่วงหน้าให้ครบวงจร
--
-- ก่อนหน้านี้ออเดอร์สั่งจองจะค้างที่สถานะ "รอของเข้า" แล้วไม่มีอะไรพามันต่อ
-- ไฟล์นี้เพิ่มกลไกจ่ายของตามคิวเมื่อของมาถึง
--
-- สิ่งที่ต่างจากการขายปกติ:
--   ตอนลูกค้าจ่ายเงิน เรายังไม่รู้ต้นทุน เพราะของยังไม่ได้ซื้อเข้ามา
--   ต้นทุนจึงถูกเติมย้อนหลัง ณ ตอนที่ของเข้าและถูกตัดจากล็อตจริง
-- ============================================================

-- ---------- สถานะใหม่: รอชำระส่วนที่เหลือ (กรณีจ่ายมัดจำ) ----------
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'pending_payment', 'paid', 'preorder_waiting', 'awaiting_balance',
  'packing', 'shipped', 'delivered', 'completed', 'cancelled'));

-- ---------- ใบเสร็จ: 1 ออเดอร์อาจมีทั้งใบมัดจำและใบส่วนที่เหลือ ----------
alter table public.receipts add column if not exists purpose text not null default 'full';
alter table public.receipts drop constraint if exists receipts_purpose_check;
alter table public.receipts add constraint receipts_purpose_check
  check (purpose in ('full', 'deposit', 'balance'));

drop index if exists public.idx_receipt_per_order;
create unique index idx_receipt_per_order_purpose
  on public.receipts (order_id, purpose) where voided_at is null;

-- ---------- แนบสลิปได้หลายรอบ (มัดจำ / ส่วนที่เหลือ) ----------
create or replace function public.fn_attach_slip(
  p_order_id  uuid,
  p_slip_path text,
  p_purpose   text default 'full'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_amount  numeric(12,2);
  v_status  text;
  v_id      uuid;
  o         record;
begin
  v_user_id := public.fn_current_user_id();
  if v_user_id is null then
    raise exception 'ยังไม่ได้เข้าสู่ระบบ';
  end if;

  select * into o from public.orders
  where id = p_order_id and user_id = v_user_id;

  if o.id is null then
    raise exception 'ไม่พบคำสั่งซื้อนี้';
  end if;

  -- ยอดเงินมาจากออเดอร์เสมอ ไม่ใช่จากสิ่งที่ client ส่งมา
  if p_purpose = 'balance' then
    if o.status <> 'awaiting_balance' then
      raise exception 'คำสั่งซื้อนี้ยังไม่ถึงขั้นชำระส่วนที่เหลือ';
    end if;
    v_amount := o.balance_due;
  else
    if o.status <> 'pending_payment' then
      raise exception 'คำสั่งซื้อนี้ยืนยันการชำระเงินไปแล้ว';
    end if;
    v_amount := coalesce(o.deposit_amount, o.total);
    p_purpose := case when o.is_deposit_only then 'deposit' else 'full' end;
  end if;

  insert into public.payments
    (order_id, method, purpose, amount, slip_url, verify_status)
  values
    (p_order_id, 'bank_transfer_slip', p_purpose, v_amount, p_slip_path, 'pending')
  returning id into v_id;

  return v_id;
end $$;

-- ---------- จ่ายของตามคิว: ใครจองก่อนได้ก่อน ----------
create or replace function public.fn_fulfill_preorders(
  p_book_id    uuid,
  p_created_by uuid default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  q             record;
  o             record;
  v_available   int;
  v_take        int;
  v_cogs        numeric(14,4);
  v_prev_qty    int;
  v_prev_cogs   numeric(14,4);
  v_filled      int := 0;
  v_order_ids   uuid[] := '{}';
  v_oid         uuid;
begin
  -- ของที่แจกได้ = คงเหลือจริง − ที่ลูกค้าคนอื่นจองไว้ชั่วคราว
  -- ไม่หัก safety_buffer เพราะคิวสั่งจองคือลูกค้าที่จ่ายเงินมาแล้ว ต้องได้ก่อน
  select coalesce(sum(qty_remaining), 0) into v_available
  from public.purchase_lots where book_id = p_book_id;

  v_available := v_available - coalesce((
    select sum(qty) from public.stock_reservations
    where book_id = p_book_id and expires_at > now()), 0);

  if v_available <= 0 then return 0; end if;

  for q in
    select pq.*
    from public.preorder_queue pq
    join public.orders ord on ord.id = pq.order_id
    where pq.book_id = p_book_id
      and pq.status in ('waiting', 'partially_filled')
      and ord.status = 'preorder_waiting'   -- จ่ายเงินแล้วเท่านั้น
    order by pq.queued_at
    for update of pq
  loop
    exit when v_available <= 0;

    v_take := least(q.qty - q.qty_fulfilled, v_available);
    continue when v_take <= 0;

    -- ตัดสต็อกจริง ได้ต้นทุนจริงของล็อตที่ถูกตัด
    v_cogs := public.fn_consume_stock_fifo(
      p_book_id, v_take, q.order_id, p_created_by, 'sale', 'จ่ายของตามคิวสั่งจอง');

    -- เติมต้นทุนย้อนหลังลงในรายการสินค้า (เฉลี่ยถ่วงน้ำหนักถ้าทยอยจ่าย)
    select fulfilled_qty, coalesce(unit_cogs, 0)
      into v_prev_qty, v_prev_cogs
    from public.order_items where id = q.order_item_id;

    update public.order_items
       set fulfilled_qty = v_prev_qty + v_take,
           unit_cogs = round(
             ((v_prev_cogs * v_prev_qty) + v_cogs) / (v_prev_qty + v_take), 4)
     where id = q.order_item_id;

    update public.preorder_queue
       set qty_fulfilled = qty_fulfilled + v_take,
           status = case when qty_fulfilled + v_take >= qty
                         then 'filled' else 'partially_filled' end
     where id = q.id;

    v_available := v_available - v_take;
    v_filled    := v_filled + v_take;

    if not (q.order_id = any(v_order_ids)) then
      v_order_ids := v_order_ids || q.order_id;
    end if;
  end loop;

  -- ออเดอร์ไหนได้ของครบแล้วบ้าง
  foreach v_oid in array v_order_ids loop
    if not exists (
      select 1 from public.order_items
      where order_id = v_oid and fulfilled_qty < qty
    ) then
      select * into o from public.orders where id = v_oid;

      update public.orders
         set cogs_total = (
               select round(sum(qty * coalesce(unit_cogs, 0)), 2)
               from public.order_items where order_id = v_oid),
             status = case when o.is_deposit_only and coalesce(o.balance_due, 0) > 0
                           then 'awaiting_balance' else 'paid' end
       where id = v_oid;

      -- ออกใบเสร็จให้เฉพาะออเดอร์ที่จ่ายเต็มจำนวนแล้ว
      if not (o.is_deposit_only and coalesce(o.balance_due, 0) > 0) then
        insert into public.receipts
          (order_id, receipt_no, purpose, seller_snapshot, buyer_snapshot, total, issued_by)
        values
          (v_oid, public.fn_next_receipt_no(), 'full',
           jsonb_build_object('name', current_setting('app.shop_name', true)),
           o.shipping_address, o.total, p_created_by)
        on conflict do nothing;
      end if;
    end if;
  end loop;

  return v_filled;
end $$;

-- ---------- รับของเข้า แล้วจ่ายให้คิวทันที ----------
create or replace function public.fn_receive_stock(
  p_book_id       uuid,
  p_qty           int,
  p_unit_cost     numeric,
  p_shipping_cost numeric default 0,
  p_supplier      text    default null,
  p_received_at   date    default current_date,
  p_invoice_no    text    default null,
  p_lot_no        text    default null,
  p_note          text    default null,
  p_created_by    uuid    default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_lot_id uuid;
  v_landed numeric(12,4);
begin
  if p_qty <= 0 then
    raise exception 'จำนวนที่รับเข้าต้องมากกว่า 0';
  end if;
  if p_unit_cost < 0 then
    raise exception 'ต้นทุนต่อเล่มต้องไม่ติดลบ';
  end if;

  insert into public.purchase_lots (
    book_id, lot_no, supplier, received_at, invoice_no,
    qty_received, qty_remaining, unit_cost, shipping_cost, note, created_by
  ) values (
    p_book_id, p_lot_no, p_supplier, coalesce(p_received_at, current_date), p_invoice_no,
    p_qty, p_qty, p_unit_cost, coalesce(p_shipping_cost, 0), p_note, p_created_by
  ) returning id, landed_unit_cost into v_lot_id, v_landed;

  insert into public.stock_movements (book_id, lot_id, type, qty, unit_cost, reason, created_by)
  values (p_book_id, v_lot_id, 'purchase', p_qty, v_landed,
          coalesce(p_note, 'รับสินค้าเข้าสต็อก'), p_created_by);

  -- ★ ของเข้าแล้ว จ่ายให้คนที่สั่งจองรออยู่ก่อนเป็นอันดับแรก
  perform public.fn_fulfill_preorders(p_book_id, p_created_by);

  perform public.fn_enqueue_stock_sync(p_book_id);
  return v_lot_id;
end $$;

-- ---------- ยกเลิกการสั่งจอง ----------
create or replace function public.fn_cancel_preorder(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select * into o from public.orders where id = p_order_id;
  if o.id is null then raise exception 'ไม่พบคำสั่งซื้อ'; end if;
  if o.order_type <> 'preorder' then
    raise exception 'คำสั่งซื้อนี้ไม่ใช่แบบสั่งจอง';
  end if;
  if o.status not in ('pending_payment', 'preorder_waiting', 'awaiting_balance') then
    raise exception 'ยกเลิกไม่ได้ เพราะของถูกจ่ายออกไปแล้ว (สถานะ: %)', o.status;
  end if;

  -- ถ้าจ่ายของไปบางส่วนแล้ว ต้องคืนของกลับก่อนด้วยเมนูปรับสต็อก
  if exists (select 1 from public.order_items where order_id = p_order_id and fulfilled_qty > 0) then
    raise exception 'ออเดอร์นี้จ่ายของไปบางส่วนแล้ว ให้จัดการคืนของด้วยเมนูปรับสต็อกก่อน';
  end if;

  update public.preorder_queue set status = 'cancelled' where order_id = p_order_id;
  update public.orders set status = 'cancelled' where id = p_order_id;
end $$;

-- ---------- วิวสำหรับหน้าจัดการ ----------
create or replace view public.v_preorder_demand
with (security_invoker = on) as
select
  b.id as book_id, b.sku, b.title, b.preorder_release_date,
  sum(pq.qty - pq.qty_fulfilled)                as qty_waiting,
  count(distinct pq.order_id)                   as order_count,
  min(pq.queued_at)                             as first_queued_at,
  coalesce((select sum(pl.qty_remaining) from public.purchase_lots pl
            where pl.book_id = b.id), 0)        as qty_on_hand
from public.preorder_queue pq
join public.books b on b.id = pq.book_id
join public.orders o on o.id = pq.order_id
where pq.status in ('waiting', 'partially_filled')
  and o.status in ('pending_payment', 'preorder_waiting')
group by b.id, b.sku, b.title, b.preorder_release_date;

create or replace view public.v_preorder_queue_detail
with (security_invoker = on) as
select
  pq.id, pq.book_id, b.sku, b.title,
  pq.order_id, o.order_no, o.status as order_status,
  u.display_name as customer_name,
  pq.qty, pq.qty_fulfilled, pq.qty - pq.qty_fulfilled as qty_remaining,
  pq.queued_at, pq.status,
  row_number() over (partition by pq.book_id order by pq.queued_at) as queue_position
from public.preorder_queue pq
join public.books b  on b.id = pq.book_id
join public.orders o on o.id = pq.order_id
left join public.users u on u.id = o.user_id
where pq.status in ('waiting', 'partially_filled');

revoke execute on function public.fn_fulfill_preorders(uuid, uuid) from public, anon;
revoke execute on function public.fn_cancel_preorder(uuid) from public, anon;
grant  execute on function public.fn_fulfill_preorders(uuid, uuid) to authenticated, service_role;
grant  execute on function public.fn_cancel_preorder(uuid) to authenticated, service_role;
grant  execute on function public.fn_attach_slip(uuid, text, text) to authenticated, service_role;
grant  select on public.v_preorder_demand, public.v_preorder_queue_detail to authenticated;

-- ============================================================
-- ส่วนที่ 2: มัดจำ
-- ============================================================

-- ---------- สร้างออเดอร์: คิดมัดจำถ้าหนังสือตั้ง preorder_deposit_pct ไว้ ----------
create or replace function public.fn_create_orders_from_cart(
  p_shipping_address jsonb,
  p_customer_note    text default null
) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  v_user_id     uuid;
  v_cart_id     uuid;
  v_group       text;
  v_order_id    uuid;
  v_order_ids   uuid[] := '{}';
  v_subtotal    numeric(12,2);
  v_shipping    numeric(12,2);
  v_deposit     numeric(12,2);
  v_flat        numeric(12,2);
  v_threshold   numeric(12,2);
  v_release     date;
  v_expires     timestamptz := now() + interval '30 minutes';
  it            record;
begin
  v_user_id := public.fn_current_user_id();
  if v_user_id is null then
    raise exception 'ยังไม่ได้เข้าสู่ระบบ';
  end if;

  if p_shipping_address is null
     or coalesce(p_shipping_address->>'recipient_name','') = ''
     or coalesce(p_shipping_address->>'phone','') = ''
     or coalesce(p_shipping_address->>'postcode','') = '' then
    raise exception 'ข้อมูลที่อยู่จัดส่งไม่ครบ';
  end if;

  select id into v_cart_id from public.cart where user_id = v_user_id;
  if v_cart_id is null then
    raise exception 'ไม่พบตะกร้า';
  end if;

  select flat_fee, free_threshold into v_flat, v_threshold
  from public.shipping_rules
  where is_active and channel_id is null
  order by effective_from desc limit 1;

  v_flat      := coalesce(v_flat, 40);
  v_threshold := coalesce(v_threshold, 500);

  foreach v_group in array array['stock','preorder'] loop

    select
      sum(ci.qty * b.sell_price),
      max(b.preorder_release_date),
      -- มัดจำคิดรายเล่มตาม % ที่ตั้งไว้ เล่มไหนไม่ตั้งถือว่าจ่ายเต็ม
      sum(ci.qty * b.sell_price * coalesce(b.preorder_deposit_pct, 100) / 100)
    into v_subtotal, v_release, v_deposit
    from public.cart_items ci
    join public.books b on b.id = ci.book_id
    where ci.cart_id = v_cart_id
      and (case when v_group = 'stock' then b.stock_mode = 'stock'
                else b.stock_mode <> 'stock' end)
      and b.is_active;

    continue when v_subtotal is null;

    v_shipping := case when v_subtotal >= v_threshold then 0 else v_flat end;

    -- ของพร้อมส่งจ่ายเต็มเสมอ ส่วนสั่งจองอาจจ่ายแค่มัดจำ
    if v_group = 'stock' or v_deposit >= v_subtotal then
      v_deposit := null;
    else
      v_deposit := round(v_deposit, 2);
    end if;

    insert into public.orders (
      order_no, channel_id, user_id, order_type, status,
      subtotal, shipping_fee, total, expected_release_date,
      is_deposit_only, deposit_amount, balance_due,
      shipping_address, customer_note
    ) values (
      public.fn_next_order_no(), 1, v_user_id,
      case when v_group = 'stock' then 'normal' else 'preorder' end,
      'pending_payment',
      v_subtotal, v_shipping, v_subtotal + v_shipping,
      case when v_group = 'stock' then null else v_release end,
      v_deposit is not null,
      v_deposit,
      case when v_deposit is null then null
           else round(v_subtotal + v_shipping - v_deposit, 2) end,
      p_shipping_address, p_customer_note
    ) returning id into v_order_id;

    for it in
      select ci.book_id, ci.qty, b.title, b.sku, b.sell_price, b.stock_mode
      from public.cart_items ci
      join public.books b on b.id = ci.book_id
      where ci.cart_id = v_cart_id
        and (case when v_group = 'stock' then b.stock_mode = 'stock'
                  else b.stock_mode <> 'stock' end)
        and b.is_active
    loop
      insert into public.order_items
        (order_id, book_id, title_snapshot, sku_snapshot, qty, unit_price)
      values
        (v_order_id, it.book_id, it.title, it.sku, it.qty, it.sell_price);

      if v_group = 'stock' then
        if it.qty > (select available_to_sell from public.v_stock_summary
                     where book_id = it.book_id) then
          raise exception 'สินค้า % มีไม่พอแล้ว', it.title;
        end if;

        insert into public.stock_reservations (order_id, book_id, qty, expires_at)
        values (v_order_id, it.book_id, it.qty, v_expires);
      else
        insert into public.preorder_queue (book_id, order_id, order_item_id, qty)
        select it.book_id, v_order_id, oi.id, it.qty
        from public.order_items oi
        where oi.order_id = v_order_id and oi.book_id = it.book_id
        limit 1;
      end if;
    end loop;

    v_order_ids := v_order_ids || v_order_id;
  end loop;

  if array_length(v_order_ids, 1) is null then
    raise exception 'ตะกร้าว่าง';
  end if;

  delete from public.cart_items where cart_id = v_cart_id;
  return v_order_ids;
end $$;

-- ---------- ยืนยันการชำระส่วนที่เหลือ ----------
-- สต็อกถูกตัดไปแล้วตอนจ่ายของตามคิว ตรงนี้แค่ปิดยอดและออกใบเสร็จ
create or replace function public.fn_confirm_balance_paid(
  p_order_id   uuid,
  p_created_by uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select * into o from public.orders where id = p_order_id for update;

  if o.id is null then raise exception 'ไม่พบคำสั่งซื้อ'; end if;
  if o.status <> 'awaiting_balance' then
    raise exception 'คำสั่งซื้อนี้ไม่ได้อยู่ในสถานะรอชำระส่วนที่เหลือ (สถานะ: %)', o.status;
  end if;

  update public.orders set status = 'paid' where id = p_order_id;

  insert into public.receipts
    (order_id, receipt_no, purpose, seller_snapshot, buyer_snapshot, total, issued_by)
  values
    (p_order_id, public.fn_next_receipt_no(), 'full',
     jsonb_build_object('name', current_setting('app.shop_name', true)),
     o.shipping_address, o.total, p_created_by)
  on conflict do nothing;
end $$;

grant execute on function public.fn_confirm_balance_paid(uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_create_orders_from_cart(jsonb, text) to authenticated, service_role;
