-- ============================================================
-- 0010  สิทธิ์ระดับตาราง (GRANT)
--
-- ทำไมต้องมีไฟล์นี้:
-- Postgres มีการควบคุมสิทธิ์ 2 ชั้นที่ต้องผ่านทั้งคู่
--   1) GRANT  = บทบาทนี้แตะตารางนี้ได้ไหม        <- ไฟล์นี้
--   2) RLS    = แตะได้แล้ว เห็นแถวไหนบ้าง         <- 0008_rls.sql
--
-- Supabase รุ่นใหม่ไม่ให้สิทธิ์ชั้นที่ 1 กับตารางที่สร้างจาก migration
-- โดยอัตโนมัติอีกแล้ว ถ้าไม่มีไฟล์นี้จะเจอ "permission denied for table users"
-- ทั้งที่ policy ถูกต้องหมด
--
-- ความปลอดภัยยังอยู่ครบ เพราะ RLS เป็นตัวตัดสินว่าใครเห็นแถวไหน
-- การ GRANT กว้างตรงนี้จึงไม่ได้เปิดข้อมูลต้นทุนให้คนที่ไม่มีสิทธิ์
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

-- ---------- ผู้ที่ยังไม่ล็อกอิน: อ่านได้เฉพาะแคตตาล็อกหน้าร้าน ----------
grant select on
  public.books,
  public.categories,
  public.v_public_stock,
  public.shipping_rules,
  public.carriers
to anon;

-- ---------- ผู้ที่ล็อกอินแล้ว: เปิดสิทธิ์ตาราง แล้วให้ RLS คุมรายแถว ----------
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- service_role: ใช้โดย webhook / cron / งานระบบ ----------
-- role นี้มี BYPASSRLS อยู่แล้ว แต่ยังต้องมี GRANT ระดับตารางด้วย
-- ไม่งั้นงานเบื้องหลังจะเจอ "permission denied" ทั้งที่ควรทำได้ทุกอย่าง
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ---------- ตารางที่สร้างในอนาคตให้ได้สิทธิ์เดียวกันอัตโนมัติ ----------
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;

-- ---------- ฟังก์ชัน ----------
grant execute on function public.fn_has_permission(text)   to anon, authenticated;
grant execute on function public.fn_current_user_id()      to anon, authenticated;

-- ฟังก์ชันที่แตะสต็อกและต้นทุน: เฉพาะผู้ล็อกอิน (ยังต้องผ่าน RLS อีกชั้น)
grant execute on function
  public.fn_receive_stock(uuid,int,numeric,numeric,text,date,text,text,text,uuid)
to authenticated;
grant execute on function
  public.fn_consume_stock_fifo(uuid,int,uuid,uuid,text,text) to authenticated;
grant execute on function
  public.fn_adjust_stock(uuid,int,text,text,uuid) to authenticated;
grant execute on function
  public.fn_confirm_order_paid(uuid,uuid) to authenticated;
grant execute on function public.fn_expire_reservations() to authenticated;
grant execute on function public.fn_enqueue_stock_sync(uuid) to authenticated;
grant execute on function public.fn_next_order_no()   to authenticated;
grant execute on function public.fn_next_receipt_no() to authenticated;
