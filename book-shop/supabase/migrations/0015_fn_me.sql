-- ============================================================
-- 0015  fn_me() — ดึงตัวตนและสิทธิ์ในรอบเดียว
--
-- ปัญหาเดิม: การโหลดหน้าหนึ่งต้องยิง HTTP ไป Supabase 2 รอบ
--   1) auth.getUser()  → ถาม GoTrue ว่าโทเคนนี้เป็นใคร
--   2) select users + user_roles + role_permissions → ถามว่ามีสิทธิ์อะไร
-- บน Docker/WSL แต่ละรอบกินเวลา 30-70 ms รวมแล้วเป็นครึ่งหนึ่งของเวลาโหลดหน้า
--
-- ฟังก์ชันนี้ยุบเหลือรอบเดียว โดยไม่ลดความปลอดภัย:
-- PostgREST เป็นคนตรวจลายเซ็น JWT ก่อนตั้งค่า auth.uid() ให้ ถ้าโทเคนปลอมหรือหมดอายุ
-- auth.uid() จะเป็น null และฟังก์ชันคืน null
-- ============================================================
create or replace function public.fn_me()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id',           u.id,
    'auth_user_id', u.auth_user_id,
    'display_name', u.display_name,
    'email',        u.email,
    'line_user_id', u.line_user_id,
    'roles',        coalesce((
      select jsonb_agg(distinct r.code)
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = u.id
    ), '[]'::jsonb),
    'permissions',  coalesce((
      select jsonb_agg(distinct p.code)
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = u.id
    ), '[]'::jsonb)
  )
  from public.users u
  where u.auth_user_id = auth.uid() and u.is_active;
$$;

revoke execute on function public.fn_me() from public;
grant  execute on function public.fn_me() to anon, authenticated, service_role;
