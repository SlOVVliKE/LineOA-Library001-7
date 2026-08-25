-- ============================================================
-- 0023  แก้คำเตือน "Auth RLS Initialization Plan" (ระดับ 2 — ความเร็ว)
--
-- ปัญหา:
-- policy ที่เขียนว่า  using (fn_has_permission('order.read'))
-- Postgres จะเรียกฟังก์ชันนั้น "ทุกแถว" ที่กรอง
-- ตารางมี 10 แถวไม่รู้สึกอะไร แต่พอมีออเดอร์เป็นหมื่น
-- ฟังก์ชันจะถูกเรียกเป็นหมื่นครั้งเพื่อตอบคำถามเดียวกันซ้ำๆ
--
-- วิธีแก้ที่ Supabase แนะนำ:
-- ครอบด้วย (select ...) กลายเป็น  using ((select fn_has_permission('order.read')))
-- Postgres จะมองเป็น subquery ที่ไม่อ้างอิงแถว จึงคำนวณครั้งเดียวแล้วใช้ซ้ำ
--
-- ปลอดภัยเพราะอะไร:
-- fn_has_permission, fn_current_user_id และ auth.uid() ประกาศเป็น stable ทั้งหมด
-- คือให้ผลเท่าเดิมตลอดทั้ง statement การคำนวณครั้งเดียวจึงได้คำตอบเดียวกัน
-- ไม่ใช่การผ่อนเงื่อนไข ไม่มีใครเห็นข้อมูลเพิ่มขึ้นแม้แต่แถวเดียว
--
-- ------------------------------------------------------------
-- บันทึกความผิดพลาด 2 รอบก่อนหน้า — ต้นเหตุเดียวกันทั้งคู่
--
-- เรื่องที่ต้องรู้: Postgres ไม่เก็บเงื่อนไข policy ตามที่เราพิมพ์
-- มันแปลงเป็นโครงสร้างภายในแล้วเขียนกลับออกมาใหม่ในรูปแบบของมันเอง
-- สิ่งที่เราสั่งไปว่า  (select auth.uid())
-- จะถูกเก็บและอ่านกลับมาเป็น  ( SELECT auth.uid() AS uid)
-- คือเติมทั้งช่องว่างและชื่อคอลัมน์ให้ subquery เอง
--
-- รอบที่ 1: regex ในด่านตรวจไม่เผื่อ AS จึงมองไม่เห็นว่าครอบไปแล้ว
--
-- รอบที่ 2: แก้ regex ให้เผื่อ AS แล้ว แต่เปลี่ยนวิธีตรวจเป็น
--           "แปลงซ้ำแล้วต้องได้ผลเท่าเดิม" ซึ่งผิดยิ่งกว่าเดิม
--           เพราะตัวแปลงคืนค่าเป็น (SELECT auth.uid())
--           ส่วน Postgres เก็บเป็น ( SELECT auth.uid() AS uid)
--           สองอันนี้ต่างกันเสมอในเชิงตัวอักษร ด่านนี้จึงไม่มีทางผ่านได้เลย
--
-- รอบนี้เลิกเทียบข้อความว่าเหมือนกันไหม เปลี่ยนมาถามคำถามที่ถูกจริงๆ ว่า
-- "ยังมีฟังก์ชันตัวไหนที่ไม่ได้อยู่ใน (select ...) หลงเหลืออยู่หรือเปล่า"
-- ทำโดยลบส่วนที่ครอบแล้วทิ้งไป ถ้ายังเหลือชื่อฟังก์ชัน แปลว่ายังไม่ครบ
-- วิธีนี้ไม่สนใจว่า Postgres จะจัดรูปแบบข้อความยังไง
-- ------------------------------------------------------------
--
-- รันซ้ำได้ ตัวที่ครอบครบแล้วจะถูกข้าม
-- ============================================================

-- ---------- ตัวช่วยที่ 1: ยังมีฟังก์ชันที่ไม่ถูกครอบเหลืออยู่ไหม ----------
-- ใช้ทั้งตอนเลือกว่าจะแก้ตัวไหน และตอนตรวจผลตอนท้าย
-- ทั้งสองที่ใช้ตัวเดียวกัน จะได้ไม่มีทางตอบไม่ตรงกัน
create or replace function pg_temp.needs_wrap(expr text) returns boolean
language sql immutable as $fn$
  select regexp_replace(
           coalesce($1, ''),
           -- รูปแบบของฟังก์ชันที่ "ครอบแล้ว" — เผื่อ AS <ชื่อ> ที่ Postgres เติมให้
           '\(\s*SELECT\s+((public\.)?fn_has_permission\([^()]*\)|(public\.)?fn_current_user_id\(\)|auth\.uid\(\))(\s+AS\s+[a-zA-Z_][a-zA-Z0-9_]*)?\s*\)',
           '', 'gi')
         ~* 'auth\.uid\(\)|fn_current_user_id|fn_has_permission'
$fn$;

-- ---------- ตัวช่วยที่ 2: ครอบให้ครบ ----------
create or replace function pg_temp.wrap_stable(expr text) returns text
language sql immutable as $fn$
  select case when $1 is null then null else
    -- ขั้นที่ 2: ครอบใหม่
    regexp_replace(
      -- ขั้นที่ 1: คลายของที่ครอบอยู่แล้วออกก่อน กันครอบซ้อน
      regexp_replace(
        $1,
        '\(\s*SELECT\s+((public\.)?fn_has_permission\([^()]*\)|(public\.)?fn_current_user_id\(\)|auth\.uid\(\))(\s+AS\s+[a-zA-Z_][a-zA-Z0-9_]*)?\s*\)',
        '\1', 'gi'),
      '((public\.)?fn_has_permission\([^()]*\)|(public\.)?fn_current_user_id\(\)|auth\.uid\(\))',
      '(SELECT \1)', 'gi')
  end
$fn$;


do $$
declare
  r      record;
  v_qual text;
  v_chk  text;
  v_stmt text;
  v_n    int := 0;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (pg_temp.needs_wrap(qual) or pg_temp.needs_wrap(with_check))
    order by tablename, policyname
  loop
    v_qual := pg_temp.wrap_stable(r.qual);
    v_chk  := pg_temp.wrap_stable(r.with_check);

    -- policy แบบ INSERT ไม่มี using ส่วน SELECT ไม่มี with check
    -- ต้องต่อเฉพาะท่อนที่มีจริง ไม่งั้น ALTER POLICY จะ error
    v_stmt := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if v_qual is not null then
      v_stmt := v_stmt || format(' using (%s)', v_qual);
    end if;
    if v_chk is not null then
      v_stmt := v_stmt || format(' with check (%s)', v_chk);
    end if;

    execute v_stmt;
    v_n := v_n + 1;
    raise notice '%', v_stmt;
  end loop;

  raise notice 'แก้ policy ไปทั้งหมด % ตัว', v_n;
end $$;


-- ============================================================
--  ด่านตรวจ: ต้องไม่เหลือฟังก์ชันที่ยังไม่ถูกครอบในทุก policy
-- ============================================================
do $$
declare v_left int; v_who text;
begin
  select count(*), string_agg(tablename || '.' || policyname, ', ')
    into v_left, v_who
  from pg_policies
  where schemaname = 'public'
    and (pg_temp.needs_wrap(qual) or pg_temp.needs_wrap(with_check));

  if v_left > 0 then
    raise exception 'ยังเหลือ policy ที่ไม่ได้ครอบ % ตัว: % — ยกเลิกทั้งหมด', v_left, v_who;
  end if;

  raise notice 'ตรวจแล้ว: ทุก policy ถูกครอบด้วย (select ...) ครบ';
end $$;
