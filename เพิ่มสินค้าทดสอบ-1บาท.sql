-- ============================================================
--  สินค้าทดสอบราคา 1 บาท สำหรับทดลองระบบตรวจสลิปอัตโนมัติ
--
--  ใช้ครั้งเดียวแล้วปิดการขายทีหลังได้ (ดูคำสั่งท้ายไฟล์)
--  รันซ้ำได้ไม่เสียหาย
-- ============================================================

-- ---------- 1. หมวดสำหรับของทดสอบ ----------
insert into public.categories (name, slug, sort_order)
values ('ทดสอบระบบ', 'test', 99)
on conflict (slug) do nothing;

-- ---------- 2. สินค้าราคา 1 บาท ----------
insert into public.books
  (sku, title, author, publisher, category_id, sell_price,
   weight_grams, reorder_point, safety_buffer, stock_mode, description)
select 'TEST-0001', 'สินค้าทดสอบระบบ (อย่าสั่งซื้อ)', 'ระบบ', '—',
       c.id, 1.00, 1, 0, 0, 'stock',
       'รายการนี้มีไว้ทดสอบระบบตรวจสลิปอัตโนมัติเท่านั้น กรุณาอย่าสั่งซื้อ'
from public.categories c
where c.slug = 'test'
on conflict (sku) do nothing;

-- ---------- 3. รับเข้า 5 ชิ้น ต้นทุน 0 ----------
-- safety_buffer ตั้งเป็น 0 ไว้แล้ว จึงขายได้ครบ 5 ชิ้น
do $$
declare
  v_owner uuid;
  v_book  uuid;
begin
  select u.id into v_owner
  from public.users u
  join public.user_roles ur on ur.user_id = u.id
  join public.roles r on r.id = ur.role_id
  where r.code = 'owner'
  limit 1;

  select id into v_book from public.books where sku = 'TEST-0001';

  if v_book is not null and not exists (
       select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(
      v_book, 5, 0.00, 0.00, 'ทดสอบระบบ',
      current_date, null, 'LOT-TEST', 'ของทดสอบ ไม่ใช่สินค้าจริง', v_owner);
  end if;
end $$;

-- ---------- ตรวจผล ----------
select b.sku, b.title, b.sell_price as ราคา,
       coalesce(vs.available_to_sell, 0) as ขายได้
from public.books b
left join public.v_public_stock vs on vs.book_id = b.id
where b.sku = 'TEST-0001';

-- ============================================================
--  หลังทดสอบเสร็จ ซ่อนไม่ให้ลูกค้าเห็น (รันแยกทีหลัง)
-- ============================================================
-- update public.books set is_active = false where sku = 'TEST-0001';
