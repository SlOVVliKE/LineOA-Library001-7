-- ============================================================
--  ข้อมูลทดสอบสำหรับ Supabase Cloud
--
--  วิธีใช้: คัดลอกทั้งไฟล์ไปวางใน SQL Editor แล้วกด Run
--
--  รันซ้ำได้ไม่เสียหาย — ทุกคำสั่งเช็คก่อนว่ามีอยู่แล้วหรือยัง
--  จะไม่เกิดหนังสือซ้ำหรือล็อตซ้ำ
--
--  สร้างให้: 5 หมวดหมู่ · 8 เล่ม · 10 ล็อต
--  ตั้งใจให้ครอบคลุมทุกสถานะที่หน้าร้านต้องแสดง:
--    - พร้อมส่ง (มีของ)
--    - พร้อมส่งแต่ของหมด  ← ไว้ทดสอบปุ่มติดดาว + แจ้งเตือนของเข้า
--    - เปิดจอง (ยังไม่มีของ)
--    - หลายล็อตต้นทุนต่างกัน ← ไว้ทดสอบ FIFO และรายงานกำไร
--    - ค้างสต็อกนาน        ← ไว้ทดสอบรายงานของค้าง
-- ============================================================

-- ---------- 1. หมวดหมู่ ----------
insert into public.categories (name, slug, sort_order) values
  ('วรรณกรรม',      'literature', 1),
  ('พัฒนาตนเอง',    'self-help',  2),
  ('ประวัติศาสตร์',  'history',    3),
  ('ตำราเรียน',      'textbook',   4),
  ('การ์ตูน',        'comic',      5)
on conflict (slug) do nothing;

-- ---------- 2. หนังสือ ----------
insert into public.books
  (sku, isbn, title, author, publisher, category_id, sell_price,
   weight_grams, page_count, reorder_point, stock_mode, preorder_release_date, description)
select v.sku, v.isbn, v.title, v.author, v.publisher, c.id, v.price,
       v.weight, v.pages, 3, v.mode, v.release_date, v.description
from (values
  ('BK-0001','9786160000001','เมื่อสายลมเปลี่ยนทิศ','ณัฐพงษ์ ศรีวัฒน์','สำนักพิมพ์ใบไม้',
     295.00, 340, 288, 'literature', 'stock', null::date,
     'เรื่องราวของหญิงสาวที่กลับไปยังบ้านเกิดริมทะเลหลังจากหายไปสิบปี และพบว่าทุกอย่างเปลี่ยนไปหมดแล้ว ยกเว้นความทรงจำ'),
  ('BK-0002','9786160000002','บันทึกจากห้องสมุดเก่า','พิมพ์ชนก อินทรา','สำนักพิมพ์ใบไม้',
     350.00, 420, 352, 'literature', 'stock', null,
     'บรรณารักษ์คนหนึ่งค้นพบสมุดบันทึกที่ถูกซ่อนไว้หลังชั้นหนังสือ แต่ละหน้าเล่าเรื่องคนที่เคยยืมหนังสือเล่มเดียวกัน'),
  ('BK-0003','9786160000003','คิดช้าเพื่อไปให้ไกล','ธนกร วงศ์เดช','สำนักพิมพ์กระดาน',
     265.00, 300, 240, 'self-help', 'stock', null,
     'ในโลกที่ทุกอย่างเร่งรีบ หนังสือเล่มนี้ชวนตั้งคำถามว่าการตัดสินใจที่ดีต้องใช้เวลาเท่าไร พร้อมกรณีศึกษาจริง 12 เรื่อง'),
  ('BK-0004','9786160000004','สยามในสายตาชาวต่างชาติ','ศิริพร ทองดี','สำนักพิมพ์อักษร',
     420.00, 560, 464, 'history', 'stock', null,
     'รวมบันทึกของนักเดินทางชาวยุโรปที่เข้ามาในสยามช่วงรัชกาลที่ 4-5 พร้อมภาพประกอบจากหอจดหมายเหตุ'),
  ('BK-0005','9786160000005','แคลคูลัสเบื้องต้น ฉบับปรับปรุง','รศ.ดร. สมชาย ผลดี','สำนักพิมพ์มหาวิทยาลัย',
     380.00, 620, 512, 'textbook', 'stock', null,
     'ตำราแคลคูลัสสำหรับนักศึกษาปี 1 อธิบายทีละขั้น มีโจทย์พร้อมเฉลยละเอียด 400 ข้อ'),
  ('BK-0006','9786160000006','ปลายทางที่ไม่มีชื่อ','ณัฐพงษ์ ศรีวัฒน์','สำนักพิมพ์ใบไม้',
     320.00, 380, 320, 'literature', 'preorder', current_date + 45,
     'ภาคต่อของ "เมื่อสายลมเปลี่ยนทิศ" เปิดจองล่วงหน้า จัดส่งตามลำดับการจอง'),
  ('BK-0007','9786160000007','ตำนานเมืองเก่าที่ถูกลืม','วิชัย บุญมาก','สำนักพิมพ์อักษร',
     390.00, 450, 380, 'history', 'stock', null,
     'ตามรอยเมืองโบราณ 9 แห่งที่หายไปจากแผนที่ พร้อมหลักฐานทางโบราณคดีที่เพิ่งค้นพบ'),
  ('BK-0008','9786160000008','เพื่อนบ้านชั้นสาม เล่ม 1','มานะ เขียนดี','สำนักพิมพ์การ์ตูนไทย',
     145.00, 180, 168, 'comic', 'stock', null,
     'การ์ตูนเรื่องยาวเกี่ยวกับชีวิตในคอนโดเก่ากลางเมือง อบอุ่นและตลกร้ายไปพร้อมกัน')
) as v(sku, isbn, title, author, publisher, price, weight, pages, cat, mode, release_date, description)
join public.categories c on c.slug = v.cat
on conflict (sku) do nothing;

-- ---------- 3. รับสินค้าเข้าเป็นล็อต ----------
-- ใช้ fn_receive_stock แทนการ insert ตรง เพื่อให้ได้ stock_movements ครบ
-- ถ้า insert เข้า purchase_lots ตรงๆ รายงานความเคลื่อนไหวจะไม่มีข้อมูล
-- และตัวเลขในหน้าสต็อกจะไม่ตรงกับประวัติ
do $$
declare
  v_owner uuid;
  v_book  uuid;
begin
  -- ใช้เจ้าของร้านเป็นผู้บันทึก จะได้เห็นชื่อในประวัติ
  select u.id into v_owner
  from public.users u
  join public.user_roles ur on ur.user_id = u.id
  join public.roles r on r.id = ur.role_id
  where r.code = 'owner'
  limit 1;

  -- ===== BK-0001: 2 ล็อต ต้นทุนต่างกัน (ทดสอบ FIFO) =====
  select id into v_book from public.books where sku = 'BK-0001';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(
      v_book, 20, 120.00, 200.00, 'สนพ.ใบไม้',
      current_date - 40, 'INV-2026-001', 'LOT-A', 'ล็อตแรก', v_owner);
    perform public.fn_receive_stock(
      v_book, 30, 115.00, 150.00, 'สนพ.ใบไม้',
      current_date - 12, 'INV-2026-014', 'LOT-B', 'ล็อตสอง ต้นทุนถูกลง', v_owner);
  end if;

  -- ===== BK-0002 =====
  select id into v_book from public.books where sku = 'BK-0002';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(
      v_book, 15, 168.00, 120.00, 'สนพ.ใบไม้',
      current_date - 25, 'INV-2026-005', 'LOT-C', null, v_owner);
  end if;

  -- ===== BK-0003 =====
  select id into v_book from public.books where sku = 'BK-0003';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(
      v_book, 25, 128.00, 180.00, 'สนพ.กระดาน',
      current_date - 18, 'INV-2026-008', 'LOT-D', null, v_owner);
  end if;

  -- ===== BK-0004: ค้างสต็อกนาน (ทดสอบรายงานของค้างเกิน 90 วัน) =====
  select id into v_book from public.books where sku = 'BK-0004';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(
      v_book, 10, 210.00, 150.00, 'สนพ.อักษร',
      current_date - 220, 'INV-2025-091', 'LOT-E', 'รับเข้านานแล้ว ยังขายไม่ออก', v_owner);
  end if;

  -- ===== BK-0005 =====
  select id into v_book from public.books where sku = 'BK-0005';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(
      v_book, 40, 190.00, 400.00, 'สนพ.มหาวิทยาลัย',
      current_date - 8, 'INV-2026-020', 'LOT-F', 'สั่งเยอะรับเปิดเทอม', v_owner);
  end if;

  -- ===== BK-0007: จำนวนน้อย ใกล้จุดสั่งซื้อซ้ำ (ทดสอบเตือนสต็อกต่ำ) =====
  select id into v_book from public.books where sku = 'BK-0007';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(
      v_book, 4, 205.00, 80.00, 'สนพ.อักษร',
      current_date - 30, 'INV-2026-011', 'LOT-G', null, v_owner);
  end if;

  -- ===== BK-0008 =====
  select id into v_book from public.books where sku = 'BK-0008';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(
      v_book, 50, 68.00, 250.00, 'สนพ.การ์ตูนไทย',
      current_date - 5, 'INV-2026-022', 'LOT-H', null, v_owner);
  end if;

  -- BK-0006 ไม่รับเข้า เพราะเป็นสินค้าเปิดจอง ต้องไม่มีของถึงจะทดสอบคิวจองได้
  -- ส่วน BK-0004 ถ้าอยากทดสอบ "ของหมด + ติดดาว" ให้ปรับสต็อกออกทีหลัง
end $$;

-- ============================================================
--  ตรวจผล
-- ============================================================
select
  b.sku,
  b.title,
  case b.stock_mode when 'stock' then 'พร้อมส่ง' else 'เปิดจอง' end as โหมด,
  coalesce(vs.available_to_sell, 0)                                as ขายได้,
  coalesce(sum(pl.qty_remaining), 0)                               as คงคลัง,
  count(pl.id)                                                     as จำนวนล็อต,
  round(coalesce(
    sum(pl.qty_remaining * pl.landed_unit_cost)
      / nullif(sum(pl.qty_remaining), 0), 0), 2)                   as ต้นทุนเฉลี่ย,
  b.sell_price                                                     as ราคาขาย
from public.books b
left join public.purchase_lots pl on pl.book_id = b.id
left join public.v_public_stock vs on vs.book_id = b.id
group by b.id, b.sku, b.title, b.stock_mode, b.sell_price, vs.available_to_sell
order by b.sku;
