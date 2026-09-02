-- ============================================================
--  ระดับ 2 — ขั้นดูก่อน (DRY RUN) ยังไม่แก้อะไรทั้งสิ้น
--
--  ไฟล์นี้แสดงให้ดูว่า migration 0023 จะเขียน policy ใหม่เป็นอะไร
--  รันได้ปลอดภัย 100% ไม่มีคำสั่งที่เปลี่ยนข้อมูลหรือสิทธิ์เลย
--
--  ทำไมต้องมีขั้นนี้:
--  0023 ไปแก้ RLS ซึ่งเป็นตัวคุมว่าใครเห็นอะไร ถ้าพลาดคือล็อกตัวเองออกจากระบบ
--  ผมทดสอบกับ Postgres จริงไม่ได้ (แซนด์บ็อกซ์ไม่มีสิทธิ์ติดตั้ง)
--  จึงต้องให้ตาคนดูก่อนว่าเงื่อนไขใหม่แปลว่าเรื่องเดียวกับของเดิม
--
--  สิ่งที่ควรเห็นในผลลัพธ์:
--    คอลัมน์ "ของเดิม" กับ "ของใหม่" ต่างกันแค่มี (SELECT ...) ครอบเพิ่ม
--    ตรรกะ and/or ชื่อคอลัมน์ ชื่อสิทธิ์ ต้องเหมือนกันเป๊ะทุกตัว
--    ถ้าเห็นอะไรหายไปหรือเพิ่มมานอกจาก (SELECT ...) แปลว่าห้ามรัน 0023
-- ============================================================


-- ============================================================
--  ส่วนที่ 1 — ตัวแปลงเงื่อนไข (สร้างเป็นฟังก์ชันชั่วคราว หายเองเมื่อปิด session)
-- ============================================================
create or replace function pg_temp.wrap_stable(expr text) returns text
language sql immutable as $fn$
  select case when $1 is null then null else
    -- ขั้นที่ 2: ครอบใหม่
    regexp_replace(
      -- ขั้นที่ 1: คลายของเดิมออกก่อน เพื่อให้รันซ้ำกี่รอบก็ได้ผลเท่าเดิม
      -- (\s+AS\s+ชื่อ)? คือชื่อคอลัมน์ที่ Postgres เติมให้ subquery เอง
      -- ถ้าไม่เผื่อไว้จะคลายไม่ออก แล้วเข้าใจผิดว่ายังไม่เคยครอบ
      regexp_replace(
        $1,
        '\(\s*SELECT\s+((public\.)?fn_has_permission\([^()]*\)|(public\.)?fn_current_user_id\(\)|auth\.uid\(\))(\s+AS\s+[a-zA-Z_][a-zA-Z0-9_]*)?\s*\)',
        '\1', 'gi'),
      '((public\.)?fn_has_permission\([^()]*\)|(public\.)?fn_current_user_id\(\)|auth\.uid\(\))',
      '(SELECT \1)', 'gi')
  end
$fn$;

-- ยังมีฟังก์ชันที่ไม่ถูกครอบเหลืออยู่ไหม
-- ห้ามตรวจด้วยการเทียบข้อความว่าเหมือนกันไหม เพราะ Postgres จัดรูปแบบใหม่เอง
-- (เก็บเป็น "( SELECT auth.uid() AS uid)" ไม่ใช่ "(SELECT auth.uid())")
-- ต้องลบส่วนที่ครอบแล้วออก แล้วดูว่ายังเหลือชื่อฟังก์ชันไหม
create or replace function pg_temp.needs_wrap(expr text) returns boolean
language sql immutable as $fn2$
  select regexp_replace(
           coalesce($1, ''),
           '\(\s*SELECT\s+((public\.)?fn_has_permission\([^()]*\)|(public\.)?fn_current_user_id\(\)|auth\.uid\(\))(\s+AS\s+[a-zA-Z_][a-zA-Z0-9_]*)?\s*\)',
           '', 'gi')
         ~* 'auth\.uid\(\)|fn_current_user_id|fn_has_permission'
$fn2$;


-- ============================================================
--  ส่วนที่ 2 — เทียบของเดิมกับของใหม่ทีละ policy
--
--  ตรวจสายตาที่คอลัมน์ "ต่างกันแค่ SELECT ไหม" ต้องเป็น ✅ ทุกบรรทัด
--  ✅ คำนวณจากการถอด (SELECT ...) ออกจากของใหม่แล้วเทียบกับของเดิม
--  ถ้าเหมือนกันเป๊ะแปลว่าไม่มีตรรกะไหนถูกแก้โดยไม่ตั้งใจ
-- ============================================================
with p as (
  select
    tablename            ตาราง,
    policyname           ชื่อ_policy,
    cmd                  ใช้กับคำสั่ง,
    qual                 เงื่อนไขเดิม,
    pg_temp.wrap_stable(qual)       เงื่อนไขใหม่,
    with_check           เช็คตอนเขียนเดิม,
    pg_temp.wrap_stable(with_check) เช็คตอนเขียนใหม่
  from pg_policies
  where schemaname = 'public'
    and (pg_temp.needs_wrap(qual) or pg_temp.needs_wrap(with_check))
)
select
  ตาราง, ชื่อ_policy, ใช้กับคำสั่ง,
  เงื่อนไขเดิม, เงื่อนไขใหม่,
  case
    -- ของใหม่ต้องไม่เหลือฟังก์ชันที่ยังไม่ถูกครอบ
    when not pg_temp.needs_wrap(เงื่อนไขใหม่)
     and not pg_temp.needs_wrap(เช็คตอนเขียนใหม่)
    then '✅ ครอบครบแล้ว'
    else '⚠️ ตรวจด้วยตาอีกรอบ'
  end ครอบครบไหม
from p
order by ตาราง, ชื่อ_policy;


-- ============================================================
--  ส่วนที่ 3 — คำสั่งจริงที่ 0023 จะรัน (แสดงเฉยๆ ไม่ได้รัน)
--  อ่านผ่านตาสักรอบ ถ้ามีบรรทัดไหนหน้าตาแปลก อย่าเพิ่งรัน 0023
-- ============================================================
select
  format('alter policy %I on public.%I%s%s;',
         policyname, tablename,
         case when qual is null then ''
              else format(' using (%s)', pg_temp.wrap_stable(qual)) end,
         case when with_check is null then ''
              else format(' with check (%s)', pg_temp.wrap_stable(with_check)) end
  ) as คำสั่งที่จะรัน
from pg_policies
where schemaname = 'public'
  and (pg_temp.needs_wrap(qual) or pg_temp.needs_wrap(with_check))
order by tablename, policyname;


-- ============================================================
--  ส่วนที่ 4 — จำนวนที่จะถูกแก้ ใช้เทียบกับตอนรัน 0023 ว่าครบไหม
-- ============================================================
select count(*) จำนวน_policy_ที่ยังไม่ได้ครอบ
from pg_policies
where schemaname = 'public'
  and (pg_temp.needs_wrap(qual) or pg_temp.needs_wrap(with_check));
