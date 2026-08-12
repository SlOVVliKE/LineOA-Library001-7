-- ============================================================
-- 0004  ช่องทางขาย (multi-channel)
-- ============================================================
create table public.channels (
  id                  serial primary key,
  code                text unique not null,     -- own_web | shopee | lazada | offline
  name_th             text not null,
  type                text not null check (type in ('owned','marketplace','offline')),
  is_active           boolean not null default true,
  commission_pct      numeric(5,2) not null default 0,
  transaction_fee_pct numeric(5,2) not null default 0,
  credentials_ref     text,                     -- ชื่อ env key ไม่เก็บ secret ใน DB
  last_sync_at        timestamptz,
  sync_status         text
);

insert into public.channels (code, name_th, type, commission_pct, transaction_fee_pct) values
  ('own_web', 'เว็บ + LINE OA',  'owned',       0,    0),
  ('offline', 'หน้าร้าน',        'offline',     0,    0),
  ('shopee',  'Shopee',          'marketplace', 5.35, 3.21),
  ('lazada',  'Lazada',          'marketplace', 5.35, 3.21);

create table public.channel_listings (
  id                uuid primary key default gen_random_uuid(),
  channel_id        int  not null references public.channels(id) on delete cascade,
  book_id           uuid not null references public.books(id) on delete cascade,
  external_item_id  text not null,
  external_model_id text not null default '',
  external_sku      text,
  listing_price     numeric(10,2),
  is_synced         boolean not null default true,
  last_pushed_qty   int,
  last_pushed_at    timestamptz,
  unique (channel_id, external_item_id, external_model_id)
);
create index idx_listings_book on public.channel_listings (book_id);

create table public.sync_jobs (
  id           uuid primary key default gen_random_uuid(),
  channel_id   int  not null references public.channels(id) on delete cascade,
  book_id      uuid references public.books(id) on delete cascade,
  job_type     text not null check (job_type in ('push_stock','push_price','pull_orders','reconcile')),
  payload      jsonb not null default '{}'::jsonb,
  status       text not null default 'queued'
               check (status in ('queued','running','done','failed')),
  attempts     int  not null default 0,
  last_error   text,
  scheduled_at timestamptz not null default now(),
  completed_at timestamptz
);
create index idx_syncjobs_queue on public.sync_jobs (status, scheduled_at);
-- กันงาน push_stock ของเล่มเดียวกันซ้อนกันในคิว (debounce)
create unique index idx_syncjobs_dedupe on public.sync_jobs (channel_id, book_id, job_type)
  where status = 'queued' and book_id is not null;

create table public.sync_discrepancies (
  id          uuid primary key default gen_random_uuid(),
  channel_id  int  not null references public.channels(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  our_qty     int  not null,
  channel_qty int  not null,
  diff        int generated always as (channel_qty - our_qty) stored,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution  text
);
