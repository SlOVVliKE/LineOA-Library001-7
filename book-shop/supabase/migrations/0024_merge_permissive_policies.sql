-- ============================================================
-- 0024  แก้คำเตือน "Multiple Permissive Policies" (ระดับ 2 — ความเร็ว)
--
-- ปัญหา:
-- 17 ตารางเขียน policy ไว้เป็นคู่ เช่น
--     orders_owner_read   for select  using (เป็นออเดอร์ของฉัน or มีสิทธิ์ order.read)
--     orders_admin_write  for all     using (มีสิทธิ์ order.read)
--
-- คำว่า "for all" คลุม select ไปด้วย เวลา select หนึ่งครั้ง Postgres จึงต้อง
-- ประเมิน policy สองตัวแล้วเอามา or กัน ทั้งที่ตัวหลังไม่ได้ให้สิทธิ์อะไรเพิ่ม
--
-- วิธีแก้:
-- ยุบ policy แบบ for all ให้เหลือเฉพาะ insert / update / delete
-- แล้วยกเงื่อนไขของมันไปรวมกับ policy ฝั่ง select ด้วย or
-- ผลลัพธ์ที่ใครเห็นอะไรได้ "เหมือนเดิมเป๊ะ" เพราะ permissive policy
-- ถูก or เข้าด้วยกันอยู่แล้วโดยธรรมชาติ เราแค่เขียน or นั้นออกมาตรงๆ
--
-- ------------------------------------------------------------
-- บันทึกความผิดพลาดที่แก้ในรอบนี้ (16 ส.ค. 2569)
--
-- รอบแรกไฟล์นี้ไล่ยุบ policy แบบ for all ทั้งหมด 25 ตัว ซึ่งมากเกินไป
--
-- ในฐานข้อมูลมี 25 ตัว แต่ 8 ตัวอยู่บนตารางที่ "มี for all อยู่ตัวเดียว"
-- (cart, cart_items, returns, stock_reservations, channel_listings,
--  sync_jobs, sync_discrepancies, book_favourites)
-- ตารางพวกนี้ไม่เคยมี policy ซ้อนกันตั้งแต่แรก จึงไม่มีคำเตือนให้แก้
-- การไปยุบมันจะเปลี่ยน policy 1 ตัวเป็น 4 ตัวโดยไม่ได้อะไรกลับมาเลย
-- มีแต่เพิ่มพื้นที่ให้พลาดและอ่านยากขึ้น
--
-- รอบนี้จึงแตะเฉพาะ 17 ตารางที่ for all ปนกับ policy อื่นจริงๆ
-- ------------------------------------------------------------
--
-- !! ก่อนรัน !!
-- 1) กด Backup ใน Supabase
-- 2) รัน "Advisor-ระดับ2ข-ดูก่อนว่าจะยุบ policy อะไร.sql" แล้วอ่านผล
-- 3) หลังรันเสร็จ ให้ล็อกอินทั้งฝั่งลูกค้าและแอดมินเพื่อยืนยันว่ายังใช้ได้
-- ============================================================

do $$
declare
  w        record;
  e        record;
  v_cmd    text;
  v_using  text;
  v_check  text;
  v_name   text;
  v_stmt   text;
  v_n      int := 0;
begin
  for w in
    select p.tablename, p.policyname, p.qual, p.with_check,
           array_to_string(p.roles, ', ') as roles
    from pg_policies p
    where p.schemaname = 'public'
      and p.cmd = 'ALL'
      -- แตะเฉพาะตารางที่มี policy อื่นปนอยู่ด้วย ตารางที่มี for all ตัวเดียว
      -- ไม่ได้ทำให้เกิดคำเตือน จึงไม่มีเหตุผลให้ไปรื้อ
      and exists (
        select 1 from pg_policies q
        where q.schemaname = 'public'
          and q.tablename  = p.tablename
          and q.cmd       <> 'ALL')
    order by p.tablename, p.policyname
  loop
    foreach v_cmd in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      select policyname, qual, with_check, array_to_string(roles, ', ') as roles
        into e
      from pg_policies
      where schemaname = 'public'
        and tablename  = w.tablename
        and cmd        = v_cmd
      order by policyname
      limit 1;

      if found then
        -- มี policy ของคำสั่งนี้อยู่แล้ว → เอาเงื่อนไขของ for all ไปต่อด้วย or
        -- policy แบบ for all ที่ไม่ระบุ with check จะใช้ using เป็นเงื่อนไขตอนเขียน
        -- ต้อง coalesce ให้ตรงกัน ไม่งั้นการเขียนจะหลุดหรือถูกบล็อกผิดจากเดิม
        v_using := case
          when v_cmd = 'INSERT' then null
          when e.qual is null or w.qual is null then null   -- null = ไม่จำกัดอยู่แล้ว
          else format('(%s) or (%s)', e.qual, w.qual) end;

        v_check := case
          when v_cmd in ('SELECT', 'DELETE') then null
          else format('(%s) or (%s)',
                      coalesce(e.with_check, e.qual),
                      coalesce(w.with_check, w.qual)) end;

        -- ถ้า policy เดิมผูกกับบาง role แต่ตัว for all เปิดกว้างกว่า
        -- ต้องขยาย role ให้เท่าเดิม ไม่งั้นบางคนจะเสียสิทธิ์ที่เคยมี
        if e.roles is distinct from w.roles and w.roles = 'public' then
          execute format('alter policy %I on public.%I to public',
                         e.policyname, w.tablename);
          raise notice 'ขยาย role: %.% -> public', w.tablename, e.policyname;
        end if;

        if v_using is not null or v_check is not null then
          v_stmt := format('alter policy %I on public.%I', e.policyname, w.tablename);
          if v_using is not null then
            v_stmt := v_stmt || format(' using (%s)', v_using);
          end if;
          if v_check is not null then
            v_stmt := v_stmt || format(' with check (%s)', v_check);
          end if;
          execute v_stmt;
          raise notice '%', v_stmt;
        end if;

      else
        -- ยังไม่มี policy ของคำสั่งนี้ → สร้างใหม่จากเงื่อนไขของ for all
        v_name := format('%s_%s', left(w.policyname, 40), lower(v_cmd));

        if v_cmd = 'INSERT' then
          execute format(
            'create policy %I on public.%I for insert to %s with check (%s)',
            v_name, w.tablename, w.roles, coalesce(w.with_check, w.qual, 'true'));
        elsif v_cmd = 'UPDATE' then
          execute format(
            'create policy %I on public.%I for update to %s using (%s) with check (%s)',
            v_name, w.tablename, w.roles,
            coalesce(w.qual, 'true'), coalesce(w.with_check, w.qual, 'true'));
        else
          execute format(
            'create policy %I on public.%I for %s to %s using (%s)',
            v_name, w.tablename, lower(v_cmd), w.roles, coalesce(w.qual, 'true'));
        end if;
        raise notice 'สร้างใหม่: %.% (%)', w.tablename, v_name, v_cmd;
      end if;
    end loop;

    execute format('drop policy %I on public.%I', w.policyname, w.tablename);
    raise notice 'ยุบ: %.%', w.tablename, w.policyname;
    v_n := v_n + 1;
  end loop;

  raise notice 'ยุบ policy แบบ for all ไปทั้งหมด % ตัว (คาดไว้ 17)', v_n;
end $$;


-- ============================================================
--  ด่านตรวจ
--
--  หมายเหตุสำคัญ: pg_policies.cmd ของ policy แบบ for all เก็บค่าว่า 'ALL'
--  ไม่ได้แตกเป็น SELECT/INSERT/UPDATE/DELETE ให้
--  ถ้านับการซ้อนกันด้วยการ group by cmd ตรงๆ จะได้ 0 เสมอ
--  ทั้งที่ ALL กับ SELECT ซ้อนกันอยู่จริง (นี่คือบั๊กในไฟล์ดูก่อนรอบแรก)
--  จึงต้องกาง ALL ออกเป็น 4 คำสั่งก่อนนับ
-- ============================================================
do $$
declare v_dup int; v_msg text;
begin
  with expanded as (
    select tablename,
           unnest(case when cmd = 'ALL'
                       then array['SELECT','INSERT','UPDATE','DELETE']
                       else array[cmd] end) as c
    from pg_policies
    where schemaname = 'public'
  )
  select count(*), string_agg(tablename || ' [' || c || ']', ', ')
    into v_dup, v_msg
  from (select tablename, c from expanded group by tablename, c having count(*) > 1) d;

  if v_dup > 0 then
    raise exception 'ยังมีคำสั่งที่ policy ซ้อนกัน: % — ยกเลิกทั้งหมด', v_msg;
  end if;

  raise notice 'ตรวจแล้ว: ไม่มีคำสั่งไหนที่ policy ซ้อนกันอีก';
end $$;
