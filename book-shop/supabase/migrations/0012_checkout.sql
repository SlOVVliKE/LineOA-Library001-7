-- ============================================================
-- 0012  การสั่งซื้อฝั่งลูกค้า
--
-- หลักการ: ลูกค้าไม่มีสิทธิ์ INSERT ตาราง orders / order_items / payments โดยตรง
-- ทุกอย่างต้องผ่านฟังก์ชันในไฟล์นี้ ซึ่งคิดราคาและค่าส่งจากฐานข้อมูลเอง
--
-- ถ้าเปิดให้ลูกค้า insert เองได้ เขาจะส่ง total = 0 มาก็ได้
-- การตรวจในโค้ด Next.js ไม่พอ เพราะลูกค้าถือ session จริงและยิง PostgREST ตรงได้
-- ============================================================

-- ---------- สร้างคำสั่งซื้อจากตะกร้า ----------
-- แยกของพร้อมส่งกับของสั่งจองเป็นคนละออเดอร์ คืน array ของ order id
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

  -- วนทีละกลุ่ม: ของพร้อมส่ง แล้วค่อยของสั่งจอง
  foreach v_group in array array['stock','preorder'] loop

    -- ราคามาจากตาราง books เสมอ ไม่ใช่จากสิ่งที่ client ส่งมา
    select
      sum(ci.qty * b.sell_price),
      max(b.preorder_release_date)
    into v_subtotal, v_release
    from public.cart_items ci
    join public.books b on b.id = ci.book_id
    where ci.cart_id = v_cart_id
      and (case when v_group = 'stock' then b.stock_mode = 'stock'
                else b.stock_mode <> 'stock' end)
      and b.is_active;

    continue when v_subtotal is null;

    v_shipping := case when v_subtotal >= v_threshold then 0 else v_flat end;

    insert into public.orders (
      order_no, channel_id, user_id, order_type, status,
      subtotal, shipping_fee, total, expected_release_date,
      shipping_address, customer_note
    ) values (
      public.fn_next_order_no(), 1, v_user_id,
      case when v_group = 'stock' then 'normal' else 'preorder' end,
      'pending_payment',
      v_subtotal, v_shipping, v_subtotal + v_shipping,
      case when v_group = 'stock' then null else v_release end,
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
        -- กันขายเกิน: เช็คของที่ขายได้จริง ณ วินาทีนี้
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

-- ---------- แนบสลิป ----------
-- ยอดเงินมาจากออเดอร์ ไม่ใช่จากสิ่งที่ client ส่งมา
create or replace function public.fn_attach_slip(
  p_order_id  uuid,
  p_slip_path text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_total   numeric(12,2);
  v_status  text;
  v_id      uuid;
begin
  v_user_id := public.fn_current_user_id();
  if v_user_id is null then
    raise exception 'ยังไม่ได้เข้าสู่ระบบ';
  end if;

  select total, status into v_total, v_status
  from public.orders
  where id = p_order_id and user_id = v_user_id;

  if v_total is null then
    raise exception 'ไม่พบคำสั่งซื้อนี้';
  end if;
  if v_status <> 'pending_payment' then
    raise exception 'คำสั่งซื้อนี้ยืนยันการชำระเงินไปแล้ว';
  end if;

  insert into public.payments
    (order_id, method, purpose, amount, slip_url, verify_status)
  values
    (p_order_id, 'bank_transfer_slip', 'full', v_total, p_slip_path, 'pending')
  returning id into v_id;

  return v_id;
end $$;

-- ---------- นโยบายเพิ่มเติมสำหรับลูกค้า ----------
-- อ่านคิวสั่งจองของตัวเองได้ (นโยบายเดิมครอบคลุมแล้ว แต่ยังต้องอ่านที่อยู่ตัวเอง)
create policy "ลูกค้าเพิ่มที่อยู่ของตัวเองได้"
on public.addresses for insert to authenticated
with check (user_id = public.fn_current_user_id());

revoke execute on function public.fn_create_orders_from_cart(jsonb, text) from public, anon;
revoke execute on function public.fn_attach_slip(uuid, text) from public, anon;
grant  execute on function public.fn_create_orders_from_cart(jsonb, text) to authenticated, service_role;
grant  execute on function public.fn_attach_slip(uuid, text) to authenticated, service_role;
