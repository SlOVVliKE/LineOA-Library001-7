-- ============================================================
--  ระดับ 2ข — ขั้นดูก่อน (DRY RUN) ยังไม่แก้อะไรทั้งสิ้น
--
--  แสดงว่า migration 0024 จะยุบ policy ตัวไหน และรวมเงื่อนไขไปไว้ที่ไหน
--  รันได้ปลอดภัย 100% ไม่มีคำสั่งที่เปลี่ยนสิทธิ์เลย
--
--  วิธีอ่านผล: ตารางในส่วนที่ 2 คือหัวใจ
--  คอลัมน์ "สิทธิ์อ่านหลังแก้" ต้องแปลว่าเรื่องเดียวกับ "สิทธิ์อ่านตอนนี้"
--  เพราะ Postgres เอา policy หลายตัวมา or กันอยู่แล้ว เราแค่เขียน or ออกมาตรงๆ
-- ============================================================


-- ============================================================
--  ส่วนที่ 1 — ตอนนี้คำสั่งไหนบ้างที่มี policy ซ้อนกัน (ต้นเหตุของคำเตือน)
-- ============================================================
-- pg_policies.cmd ของ policy แบบ for all เก็บว่า 'ALL' ไม่ได้แตกเป็น 4 คำสั่ง
-- ถ้า group by cmd ตรงๆ จะนับการซ้อนกันได้ 0 เสมอ ทั้งที่ ALL ทับ SELECT อยู่
-- ต้องกาง ALL ออกเป็น 4 คำสั่งก่อน ถึงจะเห็นภาพตรงกับที่ Advisor รายงาน
with expanded as (
  select tablename, policyname, cmd,
         unnest(case when cmd = 'ALL'
                     then array['SELECT','INSERT','UPDATE','DELETE']
                     else array[cmd] end) as c
  from pg_policies
  where schemaname = 'public'
)
select tablename ตาราง,
       c คำสั่ง,
       count(*) จำนวน_policy,
       string_agg(policyname || ' [' || cmd || ']', ' + ' order by policyname) policy_ที่ซ้อนกัน
from expanded
group by tablename, c
having count(*) > 1
order by tablename, c;


-- ============================================================
--  ส่วนที่ 2 — เทียบสิทธิ์อ่าน (SELECT) ก่อนและหลัง
--
--  นี่คือช่องที่ต้องดูให้ดีที่สุด เพราะถ้าพลาดคือข้อมูลรั่วหรือแอดมินอ่านไม่ได้
--  "หลังแก้" ต้องเป็นแค่การเอาสองเงื่อนไขมาต่อ or กัน ไม่มีอะไรหายหรือเพิ่ม
-- ============================================================
with allp as (
  select p.tablename, p.policyname, p.qual, p.with_check
  from pg_policies p
  where p.schemaname = 'public' and p.cmd = 'ALL'
    and exists (select 1 from pg_policies q
                where q.schemaname='public' and q.tablename=p.tablename and q.cmd<>'ALL')
),
selp as (
  select distinct on (tablename) tablename, policyname, qual
  from pg_policies where schemaname = 'public' and cmd = 'SELECT'
  order by tablename, policyname
)
select
  a.tablename                                   ตาราง,
  a.policyname                                  policy_ที่จะถูกยุบ,
  s.policyname                                  ยกเงื่อนไขไปรวมไว้ที่,
  s.qual                                        สิทธิ์อ่านตอนนี้,
  case when s.qual is null or a.qual is null then '(ไม่จำกัด)'
       else format('(%s) or (%s)', s.qual, a.qual) end  สิทธิ์อ่านหลังแก้
from allp a
left join selp s on s.tablename = a.tablename
order by a.tablename;


-- ============================================================
--  ส่วนที่ 3 — ตารางที่ยังไม่มี policy สำหรับ insert/update/delete
--  พวกนี้ 0024 จะสร้างขึ้นมาใหม่จากเงื่อนไขของ policy แบบ ALL เดิม
-- ============================================================
with allp as (
  select p.tablename, p.policyname, p.qual, p.with_check,
         array_to_string(p.roles, ', ') roles
  from pg_policies p
  where p.schemaname = 'public' and p.cmd = 'ALL'
    and exists (select 1 from pg_policies q
                where q.schemaname='public' and q.tablename=p.tablename and q.cmd<>'ALL')
)
select a.tablename ตาราง,
       c.cmd คำสั่งที่ยังไม่มี_policy,
       coalesce(a.with_check, a.qual) เงื่อนไขที่จะใช้,
       a.roles ใช้กับ_role
from allp a
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) c(cmd)
where not exists (
  select 1 from pg_policies p
  where p.schemaname = 'public' and p.tablename = a.tablename and p.cmd = c.cmd)
order by a.tablename, c.cmd;


-- ============================================================
--  ส่วนที่ 4 — นับของก่อนแก้ ไว้เทียบกับหลังแก้
--  หลังรัน 0024 แล้ว policy แบบ ALL ต้องเหลือ 0 และแถวในส่วนที่ 1 ต้องหายหมด
-- ============================================================
with expanded as (
  select tablename,
         unnest(case when cmd = 'ALL'
                     then array['SELECT','INSERT','UPDATE','DELETE']
                     else array[cmd] end) as c
  from pg_policies where schemaname = 'public'
)
select
  (select count(*) from pg_policies where schemaname='public')  policy_ทั้งหมดตอนนี้,
  (select count(*) from pg_policies p
    where p.schemaname='public' and p.cmd='ALL'
      and exists (select 1 from pg_policies q
                  where q.schemaname='public' and q.tablename=p.tablename
                    and q.cmd<>'ALL'))                          แบบ_ALL_ที่จะถูกยุบจริง,
  (select count(*) from pg_policies p
    where p.schemaname='public' and p.cmd='ALL'
      and not exists (select 1 from pg_policies q
                      where q.schemaname='public' and q.tablename=p.tablename
                        and q.cmd<>'ALL'))                      ALL_ที่อยู่ตัวเดียว_ไม่แตะ,
  (select count(*) from (
      select tablename, c from expanded group by tablename, c having count(*) > 1) d)
                                                                คำสั่งที่ซ้อนกันตอนนี้;
