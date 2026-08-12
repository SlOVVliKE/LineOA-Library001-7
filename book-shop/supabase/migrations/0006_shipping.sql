-- ============================================================
-- 0006  ขนส่ง
-- ============================================================
create table public.carriers (
  id         serial primary key,
  code       text unique not null,       -- flash | jnt
  name_th    text not null,
  is_active  boolean not null default true,
  api_config jsonb not null default '{}'::jsonb
);
insert into public.carriers (code, name_th) values
  ('flash', 'Flash Express'),
  ('jnt',   'J&T Express');

create table public.shipments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders(id) on delete restrict,
  carrier_id            int  not null references public.carriers(id),
  tracking_no           text,
  carrier_order_id      text,
  merchant_ref          text unique,     -- idempotency key ที่เราสร้างเอง
  label_url             text,
  declared_weight_grams int,
  actual_cost           numeric(10,2),   -- ค่าส่งจริงที่จ่ายขนส่ง
  cod_amount            numeric(10,2) not null default 0,
  status                text not null default 'created' check (status in
                        ('created','picked_up','in_transit','delivered','failed','returned','cancelled')),
  raw_response          jsonb,
  created_at            timestamptz not null default now(),
  delivered_at          timestamptz
);
create index idx_shipments_order on public.shipments (order_id);
create unique index idx_shipments_tracking on public.shipments (carrier_id, tracking_no)
  where tracking_no is not null;

create table public.shipment_events (
  id          uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status      text not null,
  description text,
  occurred_at timestamptz not null default now(),
  raw         jsonb
);
create index idx_ship_events on public.shipment_events (shipment_id, occurred_at desc);

create table public.shipping_rules (
  id             serial primary key,
  name           text not null,
  channel_id     int references public.channels(id) on delete cascade,
  flat_fee       numeric(10,2) not null default 40,
  free_threshold numeric(10,2) not null default 500,
  is_active      boolean not null default true,
  effective_from date not null default current_date
);
insert into public.shipping_rules (name, flat_fee, free_threshold)
values ('เหมา 40 บาท ฟรีเมื่อครบ 500', 40, 500);
