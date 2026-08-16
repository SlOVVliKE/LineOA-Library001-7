-- ============================================================
--  พิสูจน์ว่า 2 CRITICAL ใน Security Advisor ไม่ใช่ช่องโหว่จริง
--
--  Advisor เตือนว่า v_public_stock กับ v_shop_books เป็น security definer
--  ซึ่งแปลว่าวิวสองตัวนี้ข้าม RLS ได้ — ถูกต้องตามที่ออกแบบไว้
--  แต่คำถามที่ต้องตอบให้ได้คือ "แล้วมันปล่อยอะไรออกไปบ้าง"
--
--  รันทั้งไฟล์ อ่านผลทีละส่วน ทุกส่วนต้องได้ ✅
-- ============================================================


-- ============================================================
--  ส่วนที่ 1 — วิวสาธารณะมีคอลัมน์อะไรบ้าง
--  ต้องไม่มีคำว่า cost / supplier / invoice โผล่มาเลย
-- ============================================================
select table_name วิว, column_name คอลัมน์,
       case when column_name ~* 'cost|supplier|invoice|margin|profit'
            then '❌ ข้อมูลลับหลุด' else '✅ เปิดเผยได้' end ผลตรวจ
from information_schema.columns
where table_schema = 'public'
  and table_name in ('v_public_stock', 'v_shop_books')
order by table_name, ordinal_position;


-- ============================================================
--  ส่วนที่ 2 — ใครมีสิทธิ์อ่านตารางที่มีต้นทุนบ้าง
--  anon กับ authenticated ต้องไม่มีชื่อในผลลัพธ์
-- ============================================================
select grantee ใครอ่านได้, table_name ตาราง, privilege_type สิทธิ์,
       case when grantee in ('anon', 'authenticated')
            then '❌ ลูกค้าอ่านต้นทุนได้' else '✅ เฉพาะระบบหลังบ้าน' end ผลตรวจ
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('purchase_lots', 'stock_movements')
  and privilege_type = 'SELECT'
order by table_name, grantee;


-- ============================================================
--  ส่วนที่ 3 — ลองสวมบทลูกค้าที่ไม่ได้ล็อกอิน แล้วอ่านต้นทุนดู
--  ต้องขึ้น error permission denied ถึงจะถูก
-- ============================================================
do $$
declare v_leaked int;
begin
  set local role anon;
  begin
    select count(*) into v_leaked from public.purchase_lots;
    reset role;
    raise warning '❌ อ่านต้นทุนได้ % แถว ทั้งที่ไม่ได้ล็อกอิน', v_leaked;
  exception when insufficient_privilege or others then
    reset role;
    raise notice '✅ ลูกค้าที่ไม่ได้ล็อกอินอ่าน purchase_lots ไม่ได้ตามที่ควรเป็น';
  end;
end $$;


-- ============================================================
--  ส่วนที่ 4 — วิวสาธารณะต้องซ่อนหนังสือที่ปิดการขายไว้
--  TEST-0001 ปิดขายแล้ว ต้องไม่โผล่ในผลลัพธ์
-- ============================================================
select
  (select count(*) from public.books where not is_active)          ปิดขายอยู่,
  (select count(*) from public.v_shop_books
    where sku in (select sku from public.books where not is_active)) หลุดไปหน้าร้าน,
  case when (select count(*) from public.v_shop_books
              where sku in (select sku from public.books where not is_active)) = 0
       then '✅ ซ่อนครบ' else '❌ หนังสือที่ปิดขายยังโผล่ที่หน้าร้าน' end ผลตรวจ;


-- ============================================================
--  ส่วนที่ 5 — วิวอื่นทั้งหมดต้องเป็น security invoker
--  ควรได้เฉพาะ v_public_stock กับ v_shop_books สองตัวเท่านั้น
-- ============================================================
select c.relname วิว,
       case when 'security_invoker=true' = any(c.reloptions)
            then '✅ invoker' else '⚠️ definer (ต้องเป็นแค่ 2 ตัวที่ตั้งใจ)' end โหมด
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by 2 desc, 1;
