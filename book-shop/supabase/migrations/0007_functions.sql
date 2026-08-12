-- ============================================================
-- 0007  ฟังก์ชันหลัก: เลขเอกสาร · รับเข้า · FIFO · ปรับสต็อก
-- ============================================================

-- ---------- เลขที่เอกสาร ----------
create or replace function public.fn_next_order_no()
returns text language sql volatile as $$
  select 'OD-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.seq_order_no')::text, 6, '0');
$$;

create or replace function public.fn_next_receipt_no()
returns text language sql volatile as $$
  select 'RC-' || to_char(now(), 'YYMM') || '-' ||
         lpad(nextval('public.seq_receipt_no')::text, 6, '0');
$$;

-- ---------- เข้าคิวผลักสต็อกไป marketplace (debounce ด้วย partial unique index) ----------
create or replace function public.fn_enqueue_stock_sync(p_book_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.sync_jobs (channel_id, book_id, job_type, payload)
  select distinct cl.channel_id, p_book_id, 'push_stock', '{}'::jsonb
  from public.channel_listings cl
  join public.channels c on c.id = cl.channel_id
  where cl.book_id = p_book_id
    and cl.is_synced
    and c.is_active
    and c.type = 'marketplace'
  on conflict do nothing;
end $$;

-- ---------- ตัดสต็อกแบบ FIFO (หัวใจของระบบต้นทุน) ----------
-- คืนค่า COGS รวมของจำนวนที่ตัดจริง
create or replace function public.fn_consume_stock_fifo(
  p_book_id       uuid,
  p_qty           int,
  p_order_id      uuid default null,
  p_created_by    uuid default null,
  p_movement_type text default 'sale',
  p_reason        text default 'ตัดสต็อกจากการขาย'
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_remaining int := p_qty;
  v_cogs      numeric(14,4) := 0;
  v_take      int;
  r           record;
begin
  if p_qty <= 0 then
    raise exception 'จำนวนที่ตัดต้องมากกว่า 0';
  end if;

  -- ล็อกแถวล็อต กันสองออเดอร์ตัดพร้อมกันแล้วสต็อกติดลบ
  for r in
    select id, qty_remaining, landed_unit_cost
    from public.purchase_lots
    where book_id = p_book_id and qty_remaining > 0
    order by received_at asc, created_at asc
    for update
  loop
    exit when v_remaining <= 0;

    v_take := least(r.qty_remaining, v_remaining);

    update public.purchase_lots
       set qty_remaining = qty_remaining - v_take
     where id = r.id;

    insert into public.stock_movements
      (book_id, lot_id, type, qty, order_id, unit_cost, reason, created_by)
    values
      (p_book_id, r.id, p_movement_type, -v_take, p_order_id,
       r.landed_unit_cost, p_reason, p_created_by);

    v_cogs      := v_cogs + (v_take * r.landed_unit_cost);
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'สต็อกไม่พอ: ต้องการ % เล่ม ขาดอีก % เล่ม', p_qty, v_remaining
      using errcode = 'check_violation';
  end if;

  perform public.fn_enqueue_stock_sync(p_book_id);
  return round(v_cogs, 2);
end $$;

-- ---------- รับสินค้าเข้าสต็อก ----------
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

  perform public.fn_enqueue_stock_sync(p_book_id);
  return v_lot_id;
end $$;

-- ---------- ปรับสต็อกด้วยมือ (ตรวจนับ / ของเสีย / ของหาย) ----------
create or replace function public.fn_adjust_stock(
  p_book_id    uuid,
  p_qty_delta  int,                 -- + เพิ่ม, - ลด
  p_reason     text,
  p_type       text default 'adjust',
  p_created_by uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_lot_id uuid;
  v_cost   numeric(12,4);
begin
  if p_qty_delta = 0 then
    raise exception 'จำนวนที่ปรับต้องไม่เป็น 0';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'ต้องระบุเหตุผลในการปรับสต็อก';
  end if;
  if p_type not in ('adjust','damage','return','channel_correction') then
    raise exception 'ประเภทการปรับสต็อกไม่ถูกต้อง: %', p_type;
  end if;

  if p_qty_delta > 0 then
    -- เพิ่มของโดยไม่มีใบซื้อ: ใช้ต้นทุนเฉลี่ยปัจจุบัน เพื่อไม่ให้มูลค่าสต็อกเพี้ยน
    select coalesce(avg_unit_cost, 0) into v_cost
    from public.v_stock_summary where book_id = p_book_id;

    insert into public.purchase_lots
      (book_id, supplier, qty_received, qty_remaining, unit_cost, note, created_by)
    values
      (p_book_id, 'ปรับสต็อก', p_qty_delta, p_qty_delta,
       coalesce(v_cost, 0), p_reason, p_created_by)
    returning id into v_lot_id;

    insert into public.stock_movements
      (book_id, lot_id, type, qty, unit_cost, reason, created_by)
    values (p_book_id, v_lot_id, p_type, p_qty_delta, coalesce(v_cost, 0), p_reason, p_created_by);
  else
    perform public.fn_consume_stock_fifo(
      p_book_id, -p_qty_delta, null, p_created_by, p_type, p_reason);
  end if;

  perform public.fn_enqueue_stock_sync(p_book_id);
end $$;

-- ---------- ล้างการจองที่หมดอายุ (เรียกจาก cron ทุก 5 นาที) ----------
create or replace function public.fn_expire_reservations()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with deleted as (
    delete from public.stock_reservations where expires_at <= now() returning id
  )
  select count(*) into v_count from deleted;
  return v_count;
end $$;

-- ---------- ยืนยันการชำระเงิน: ตัดสต็อก + บันทึก COGS + ออกใบเสร็จ ----------
create or replace function public.fn_confirm_order_paid(
  p_order_id   uuid,
  p_created_by uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  it          record;
  v_cogs      numeric(14,4);
  v_total_cogs numeric(14,4) := 0;
  v_status    text;
  v_type      text;
begin
  select status, order_type into v_status, v_type
  from public.orders where id = p_order_id for update;

  if v_status is null then
    raise exception 'ไม่พบคำสั่งซื้อ';
  end if;
  if v_status <> 'pending_payment' then
    raise exception 'คำสั่งซื้อนี้ยืนยันการชำระเงินไปแล้ว (สถานะปัจจุบัน: %)', v_status;
  end if;

  -- pre-order: ยังไม่ตัดสต็อกและยังไม่มี COGS
  if v_type = 'preorder' then
    update public.orders
       set status = 'preorder_waiting', paid_at = now()
     where id = p_order_id;
    delete from public.stock_reservations where order_id = p_order_id;
    return;
  end if;

  for it in
    select id, book_id, qty from public.order_items where order_id = p_order_id
  loop
    v_cogs := public.fn_consume_stock_fifo(it.book_id, it.qty, p_order_id, p_created_by);
    update public.order_items
       set unit_cogs = round(v_cogs / it.qty, 4), fulfilled_qty = it.qty
     where id = it.id;
    v_total_cogs := v_total_cogs + v_cogs;
  end loop;

  update public.orders
     set status = 'paid', paid_at = now(), cogs_total = round(v_total_cogs, 2)
   where id = p_order_id;

  delete from public.stock_reservations where order_id = p_order_id;

  -- ออกใบเสร็จรับเงินอัตโนมัติ
  insert into public.receipts (order_id, receipt_no, seller_snapshot, buyer_snapshot, total, issued_by)
  select o.id,
         public.fn_next_receipt_no(),
         jsonb_build_object('name', current_setting('app.shop_name', true)),
         o.shipping_address,
         o.total,
         p_created_by
  from public.orders o where o.id = p_order_id
  on conflict do nothing;
end $$;
