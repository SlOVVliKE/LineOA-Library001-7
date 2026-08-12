-- ============================================================
-- 0003  แคตตาล็อกหนังสือ + สต็อก + ต้นทุน
-- ============================================================
create table public.categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      text unique not null,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order int not null default 0
);

create table public.books (
  id           uuid primary key default gen_random_uuid(),
  sku          text unique not null,            -- รหัสภายใน ใช้ผูกกับทุกช่องทาง
  isbn         text,
  title        text not null,
  author       text,
  publisher    text,
  category_id  uuid references public.categories(id) on delete set null,
  description  text,
  cover_url    text,
  page_count   int,
  weight_grams int not null default 300,        -- เผื่อเปลี่ยนไปคิดค่าส่งตามน้ำหนัก

  sell_price   numeric(10,2) not null check (sell_price >= 0),

  -- โหมดการขาย
  stock_mode            text not null default 'stock'
                        check (stock_mode in ('stock','preorder','backorder')),
  preorder_release_date date,
  preorder_limit        int,
  preorder_deposit_pct  numeric(5,2) check (preorder_deposit_pct between 0 and 100),

  -- เผื่อหนังสือมือสองในอนาคต
  condition      text not null default 'new'
                 check (condition in ('new','like_new','good','acceptable')),
  is_serialized  boolean not null default false,
  condition_note text,

  reorder_point int not null default 3,
  safety_buffer int not null default 1,         -- กันชนสำหรับขายหลายช่องทาง
  is_active     boolean not null default true,

  search_tsv tsvector generated always as (
    to_tsvector('simple',
      coalesce(title,'')     || ' ' ||
      coalesce(author,'')    || ' ' ||
      coalesce(publisher,'') || ' ' ||
      coalesce(isbn,''))
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_books_touch before update on public.books
  for each row execute function public.fn_touch_updated_at();

create index idx_books_search   on public.books using gin (search_tsv);
create index idx_books_title_tg on public.books using gin (title gin_trgm_ops);
create index idx_books_active   on public.books (is_active, stock_mode);
create index idx_books_category on public.books (category_id);

-- ---------- ล็อตรับเข้า = แหล่งข้อมูลต้นทุนเดียวของระบบ ----------
create table public.purchase_lots (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references public.books(id) on delete restrict,
  lot_no       text,
  supplier     text,
  received_at  date not null default current_date,
  invoice_no   text,

  qty_received int not null check (qty_received > 0),
  qty_remaining int not null check (qty_remaining >= 0),

  unit_cost     numeric(10,2) not null check (unit_cost >= 0),   -- ราคาซื้อต่อเล่ม
  shipping_cost numeric(10,2) not null default 0 check (shipping_cost >= 0),

  -- ต้นทุนจริงต่อเล่ม = ราคาซื้อ + ค่าขนส่งขาเข้าเฉลี่ย
  landed_unit_cost numeric(12,4) generated always as
    (unit_cost + shipping_cost / nullif(qty_received, 0)) stored,

  note       text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),

  constraint chk_remaining_le_received check (qty_remaining <= qty_received)
);
create index idx_lots_fifo on public.purchase_lots (book_id, received_at, created_at)
  where qty_remaining > 0;

-- ---------- สำหรับหนังสือมือสองในอนาคต: 1 แถว = 1 เล่มจริง ----------
create table public.book_units (
  id             uuid primary key default gen_random_uuid(),
  book_id        uuid not null references public.books(id) on delete restrict,
  lot_id         uuid references public.purchase_lots(id) on delete set null,
  sku_code       text unique not null,
  condition      text not null default 'good',
  condition_note text,
  photo_urls     text[],
  unit_cost      numeric(10,2),
  status         text not null default 'available'
                 check (status in ('available','reserved','sold','damaged')),
  order_id       uuid,
  created_at     timestamptz not null default now()
);

-- ---------- ทุกความเคลื่อนไหวของสต็อก (audit trail) ----------
create table public.stock_movements (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books(id) on delete restrict,
  lot_id     uuid references public.purchase_lots(id) on delete set null,
  unit_id    uuid references public.book_units(id) on delete set null,
  type       text not null
             check (type in ('purchase','sale','adjust','return','damage','channel_correction')),
  qty        int not null check (qty <> 0),     -- + เข้า, - ออก
  order_id   uuid,
  channel_id int,
  unit_cost  numeric(12,4),                     -- ต้นทุนที่ล็อกไว้ ณ เวลานั้น
  reason     text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create index idx_movements_book on public.stock_movements (book_id, created_at desc);
create index idx_movements_order on public.stock_movements (order_id);

-- ---------- การจองชั่วคราวระหว่างรอชำระเงิน ----------
create table public.stock_reservations (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null,
  book_id    uuid not null references public.books(id) on delete cascade,
  qty        int not null check (qty > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
-- หมายเหตุ: partial index ใช้ now() ไม่ได้ (ต้องเป็น IMMUTABLE)
create index idx_reservations_active on public.stock_reservations (book_id, expires_at);

-- ---------- มุมมองรวม: ยอดที่ขายได้จริง ----------
create or replace view public.v_stock_summary
with (security_invoker = on) as
select
  b.id   as book_id,
  b.sku,
  b.title,
  b.safety_buffer,
  coalesce(l.on_hand, 0)                       as on_hand,
  coalesce(r.reserved, 0)                      as reserved,
  greatest(coalesce(l.on_hand,0) - coalesce(r.reserved,0) - b.safety_buffer, 0)
                                               as available_to_sell,
  coalesce(l.stock_value, 0)                   as stock_value_at_cost,
  case when coalesce(l.on_hand,0) > 0
       then coalesce(l.stock_value,0) / l.on_hand end as avg_unit_cost
from public.books b
left join lateral (
  select sum(pl.qty_remaining)                             as on_hand,
         sum(pl.qty_remaining * pl.landed_unit_cost)       as stock_value
  from public.purchase_lots pl where pl.book_id = b.id
) l on true
left join lateral (
  select sum(sr.qty) as reserved
  from public.stock_reservations sr
  where sr.book_id = b.id and sr.expires_at > now()
) r on true;

-- ---------- วิวสาธารณะสำหรับหน้าร้าน ----------
-- ตั้งใจให้เป็น security definer (ค่าเริ่มต้น) เพื่อให้ลูกค้าเห็นจำนวนคงเหลือได้
-- โดยไม่ต้องเปิดสิทธิ์อ่านตาราง purchase_lots ซึ่งมีข้อมูลต้นทุน
create or replace view public.v_public_stock as
select
  b.id as book_id,
  b.sku,
  greatest(
    coalesce((select sum(pl.qty_remaining) from public.purchase_lots pl
              where pl.book_id = b.id), 0)
    - coalesce((select sum(sr.qty) from public.stock_reservations sr
                where sr.book_id = b.id and sr.expires_at > now()), 0)
    - b.safety_buffer, 0) as available_to_sell
from public.books b
where b.is_active;

grant select on public.v_public_stock to anon, authenticated;
