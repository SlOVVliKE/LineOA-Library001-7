-- ============================================================
-- 0005  คำสั่งซื้อ · ใบเสร็จ · การชำระเงิน   (ไม่มี VAT)
-- ============================================================
create table public.addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  recipient_name text not null,
  phone          text not null,
  line1          text not null,
  subdistrict    text,
  district       text,
  province       text not null,
  postcode       text not null,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);
create index idx_addresses_user on public.addresses (user_id);

create sequence if not exists public.seq_order_no;

create table public.orders (
  id         uuid primary key default gen_random_uuid(),
  order_no   text unique not null,
  channel_id int  not null default 1 references public.channels(id),
  user_id    uuid references public.users(id) on delete set null,

  order_type text not null default 'normal' check (order_type in ('normal','preorder')),
  status     text not null default 'pending_payment' check (status in (
    'pending_payment','paid','preorder_waiting','packing',
    'shipped','delivered','completed','cancelled')),

  -- เงิน (ไม่มี VAT: ราคาที่แสดงคือราคาที่จ่ายจริง)
  subtotal             numeric(12,2) not null default 0,
  discount             numeric(12,2) not null default 0,
  shipping_fee         numeric(12,2) not null default 0,
  total                numeric(12,2) not null default 0,
  cogs_total           numeric(12,2),
  shipping_actual_cost numeric(12,2),
  channel_fee          numeric(12,2) not null default 0,

  -- กำไรขั้นต้น = รายได้จากสินค้า - ต้นทุนสินค้า + ค่าส่งที่เก็บ - ค่าส่งที่จ่ายจริง - ค่าธรรมเนียมช่องทาง
  gross_profit numeric(12,2) generated always as (
    (subtotal - discount)
    - coalesce(cogs_total, 0)
    + shipping_fee
    - coalesce(shipping_actual_cost, 0)
    - channel_fee
  ) stored,

  -- pre-order
  is_deposit_only       boolean not null default false,
  deposit_amount        numeric(12,2),
  balance_due           numeric(12,2),
  expected_release_date date,

  -- เตรียมไว้สำหรับ COD (ยังไม่เปิดใช้)
  payment_type      text not null default 'prepaid' check (payment_type in ('prepaid','cod')),
  cod_amount        numeric(12,2) not null default 0,
  cod_remittance_id uuid,

  shipping_address jsonb,
  customer_note    text,
  internal_note    text,

  created_at   timestamptz not null default now(),
  paid_at      timestamptz,
  shipped_at   timestamptz,
  delivered_at timestamptz,
  updated_at   timestamptz not null default now()
);
create trigger trg_orders_touch before update on public.orders
  for each row execute function public.fn_touch_updated_at();
create index idx_orders_status  on public.orders (status, created_at desc);
create index idx_orders_channel on public.orders (channel_id, created_at desc);
create index idx_orders_user    on public.orders (user_id, created_at desc);

create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  book_id        uuid not null references public.books(id) on delete restrict,
  unit_id        uuid references public.book_units(id) on delete set null,
  title_snapshot text not null,
  sku_snapshot   text,
  qty            int  not null check (qty > 0),
  unit_price     numeric(10,2) not null,
  unit_cogs      numeric(12,4),                 -- null ได้ถ้าเป็น pre-order ที่ของยังไม่เข้า
  fulfilled_qty  int not null default 0,
  line_total     numeric(12,2) generated always as (qty * unit_price) stored
);
create index idx_items_order on public.order_items (order_id);
create index idx_items_book  on public.order_items (book_id);

-- ---------- คิวสั่งจอง: ใครจองก่อนได้ก่อน ----------
create table public.preorder_queue (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books(id) on delete cascade,
  order_id      uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  qty           int  not null check (qty > 0),
  qty_fulfilled int  not null default 0,
  queued_at     timestamptz not null default now(),
  status        text not null default 'waiting'
                check (status in ('waiting','partially_filled','filled','cancelled'))
);
create index idx_preorder_fifo on public.preorder_queue (book_id, queued_at)
  where status in ('waiting','partially_filled');

-- ---------- ใบเสร็จรับเงิน (แทนใบกำกับภาษี - ระบบนี้ไม่คิด VAT) ----------
create sequence if not exists public.seq_receipt_no;

create table public.receipts (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete restrict,
  receipt_no       text unique not null,        -- RC-2608-000042
  issued_at        timestamptz not null default now(),
  seller_snapshot  jsonb not null,
  buyer_snapshot   jsonb,
  total            numeric(12,2) not null,
  pdf_url          text,
  issued_by        uuid references public.users(id),
  void_reason      text,
  voided_at        timestamptz
);
-- 1 ออเดอร์ = 1 ใบเสร็จที่ยังไม่ถูกยกเลิก
create unique index idx_receipt_per_order on public.receipts (order_id)
  where voided_at is null;

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  method        text not null check (method in ('promptpay_qr','bank_transfer_slip','cod')),
  purpose       text not null default 'full' check (purpose in ('full','deposit','balance')),
  amount        numeric(12,2) not null,
  slip_url      text,
  slip_ref      text unique,                    -- กันสลิปซ้ำ - ด่านสำคัญที่สุด
  verify_status text not null default 'pending'
                check (verify_status in ('pending','auto_verified','manual_verified','rejected')),
  verify_payload jsonb,
  verified_at   timestamptz,
  verified_by   uuid references public.users(id),
  created_at    timestamptz not null default now()
);
create index idx_payments_order on public.payments (order_id);

-- ---------- การคืนสินค้า ----------
create table public.returns (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete restrict,
  order_item_id       uuid not null references public.order_items(id) on delete restrict,
  reason              text not null check (reason in
                      ('damaged','wrong_item','defective','cancelled_before_ship','withdrawal_7day')),
  qty                 int not null check (qty > 0),
  condition_on_return text,
  restock_action      text not null default 'to_damaged_bin'
                      check (restock_action in ('back_to_lot','to_damaged_bin','discard')),
  refund_amount       numeric(12,2) not null default 0,
  approved_by         uuid references public.users(id),
  created_at          timestamptz not null default now()
);

create table public.cart (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id      uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.cart(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  qty     int  not null check (qty > 0),
  unique (cart_id, book_id)
);
