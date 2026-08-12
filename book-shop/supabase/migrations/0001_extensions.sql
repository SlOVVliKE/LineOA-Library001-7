-- ============================================================
-- 0001  Extensions + helper
-- ============================================================
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- ค้นหาแบบพิมพ์ผิดได้

-- อัปเดต updated_at อัตโนมัติ
create or replace function public.fn_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
