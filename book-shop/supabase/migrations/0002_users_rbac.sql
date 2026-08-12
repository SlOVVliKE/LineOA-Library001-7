-- ============================================================
-- 0002  ผู้ใช้ + สิทธิ์ (RBAC)
-- ============================================================
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,                    -- อ้างถึง auth.users (แอดมิน)
  line_user_id  text unique,                    -- ลูกค้าที่มาจาก LINE
  email         text unique,
  display_name  text,
  picture_url   text,
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_users_touch before update on public.users
  for each row execute function public.fn_touch_updated_at();

create table public.roles (
  id       serial primary key,
  code     text unique not null,
  name_th  text not null
);

create table public.permissions (
  id          serial primary key,
  code        text unique not null,
  description text
);

create table public.role_permissions (
  role_id       int not null references public.roles(id) on delete cascade,
  permission_id int not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id int  not null references public.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

insert into public.roles (code, name_th) values
  ('owner',       'เจ้าของร้าน'),
  ('manager',     'ผู้จัดการ'),
  ('stock_staff', 'ฝ่ายสต็อก'),
  ('packer',      'ฝ่ายแพ็กของ'),
  ('support',     'ฝ่ายดูแลลูกค้า');

insert into public.permissions (code, description) values
  ('book.write',         'เพิ่ม/แก้ไขหนังสือ'),
  ('lot.write',          'บันทึกล็อตรับเข้า / ปรับสต็อก'),
  ('cost.read',          'ดูต้นทุนและรายงานกำไร'),
  ('order.read',         'ดูคำสั่งซื้อ'),
  ('order.ship',         'สร้างเลขพัสดุ / แพ็กของ'),
  ('payment.verify',     'ยืนยันการชำระเงิน'),
  ('receipt.issue',      'ออกใบเสร็จรับเงิน'),
  ('channel.manage',     'จัดการช่องทางขาย'),
  ('user.manage',        'จัดการผู้ใช้และสิทธิ์');

-- ผูกสิทธิ์เข้ากับ role
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'owner';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'manager'
  and p.code in ('book.write','lot.write','cost.read','order.read',
                 'order.ship','payment.verify','receipt.issue','channel.manage');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'stock_staff'
  and p.code in ('book.write','lot.write','order.read','order.ship');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'packer'
  and p.code in ('order.read','order.ship');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'support'
  and p.code in ('order.read');

-- ---------- helper: ผู้ใช้ปัจจุบันมีสิทธิ์นี้ไหม ----------
create or replace function public.fn_current_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.fn_has_permission(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.users u
    join public.user_roles ur      on ur.user_id = u.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p       on p.id = rp.permission_id
    where u.auth_user_id = auth.uid()
      and u.is_active
      and p.code = p_code
  );
$$;
