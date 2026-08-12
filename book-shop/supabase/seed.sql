-- ============================================================
-- seed.sql — ข้อมูลสำหรับพัฒนาในเครื่องเท่านั้น
--
-- ไฟล์นี้รันอัตโนมัติเมื่อ `supabase db reset` (local)
-- และ **ไม่ถูกส่งขึ้น production** เมื่อ `supabase db push`
-- จึงปลอดภัยที่จะมีบัญชีทดสอบและข้อมูลตัวอย่างอยู่ในนี้
-- ============================================================

-- ---------- 1. บัญชีทดสอบครบทุก role ----------
--
--   owner@bookshop.local    / bookshop1234   เจ้าของร้าน (เห็นทุกอย่าง)
--   manager@bookshop.local  / manager1234    ผู้จัดการ
--   stock@bookshop.local    / stock1234      ฝ่ายสต็อก   (ไม่เห็นรายงานกำไร)
--   packer@bookshop.local   / packer1234     ฝ่ายแพ็กของ (ไม่เห็นต้นทุน)
--   support@bookshop.local  / support1234    ดูแลลูกค้า  (ดูออเดอร์อย่างเดียว)
--   customer@bookshop.local / customer1234   ลูกค้า      (ใช้ที่ /shop)
--
-- ห้ามใช้ไฟล์นี้บน production — `supabase db push` ไม่ส่งไฟล์นี้ไปอยู่แล้ว
do $$
declare
  v_auth_id uuid;
  v_user_id uuid;
  acct      record;
begin
  for acct in
    select * from (values
      ('11111111-1111-1111-1111-111111111111'::uuid, 'owner@bookshop.local',    'bookshop1234', 'เจ้าของร้าน',   'owner',       null),
      ('22222222-2222-2222-2222-222222222222'::uuid, 'manager@bookshop.local',  'manager1234',  'ผู้จัดการร้าน',  'manager',     null),
      ('33333333-3333-3333-3333-333333333333'::uuid, 'stock@bookshop.local',    'stock1234',    'ฝ่ายสต็อก',     'stock_staff', null),
      ('44444444-4444-4444-4444-444444444444'::uuid, 'packer@bookshop.local',   'packer1234',   'ฝ่ายแพ็กของ',    'packer',      null),
      ('55555555-5555-5555-5555-555555555555'::uuid, 'support@bookshop.local',  'support1234',  'ฝ่ายดูแลลูกค้า', 'support',     null),
      ('66666666-6666-6666-6666-666666666666'::uuid, 'customer@bookshop.local', 'customer1234', 'ลูกค้าตัวอย่าง',  null,          'demoCustomer001')
    ) as t(auth_id, email, password, display_name, role_code, line_user_id)
  loop
    v_auth_id := acct.auth_id;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_auth_id, 'authenticated', 'authenticated',
      acct.email,
      crypt(acct.password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', acct.display_name),
      '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_auth_id, v_auth_id::text,
      jsonb_build_object(
        'sub',            v_auth_id::text,
        'email',          acct.email,
        'email_verified', true,
        'phone_verified', false),
      'email', now(), now(), now()
    ) on conflict do nothing;

    insert into public.users (auth_user_id, email, display_name, line_user_id)
    values (v_auth_id, acct.email, acct.display_name, acct.line_user_id)
    on conflict (auth_user_id) do update
      set email = excluded.email, display_name = excluded.display_name
    returning id into v_user_id;

    if acct.role_code is not null then
      insert into public.user_roles (user_id, role_id)
      select v_user_id, r.id from public.roles r where r.code = acct.role_code
      on conflict do nothing;
    end if;
  end loop;

  raise notice 'สร้างบัญชีทดสอบครบ 6 บัญชีแล้ว';
end $$;

-- ---------- 2. หมวดหมู่ ----------
insert into public.categories (name, slug, sort_order) values
  ('วรรณกรรม',      'literature', 1),
  ('พัฒนาตนเอง',    'self-help',  2),
  ('ประวัติศาสตร์',  'history',    3),
  ('ตำราเรียน',      'textbook',   4)
on conflict (slug) do nothing;

-- ---------- 3. หนังสือตัวอย่าง ----------
insert into public.books
  (sku, isbn, title, author, publisher, category_id, sell_price,
   weight_grams, page_count, reorder_point, stock_mode, preorder_release_date)
select v.sku, v.isbn, v.title, v.author, v.publisher, c.id, v.price,
       v.weight, v.pages, 3, v.mode, v.release_date
from (values
  ('BK-0001','9786160000001','เมื่อสายลมเปลี่ยนทิศ','ณัฐพงษ์ ศรีวัฒน์','สำนักพิมพ์ใบไม้',
     295.00, 340, 288, 'literature', 'stock',    null::date),
  ('BK-0002','9786160000002','บันทึกจากห้องสมุดเก่า','พิมพ์ชนก อินทรา','สำนักพิมพ์ใบไม้',
     350.00, 420, 352, 'literature', 'stock',    null),
  ('BK-0003','9786160000003','คิดช้าเพื่อไปให้ไกล','ธนกร วงศ์เดช','สำนักพิมพ์กระดาน',
     265.00, 300, 240, 'self-help',  'stock',    null),
  ('BK-0004','9786160000004','สยามในสายตาชาวต่างชาติ','ศิริพร ทองดี','สำนักพิมพ์อักษร',
     420.00, 560, 464, 'history',    'stock',    null),
  ('BK-0005','9786160000005','แคลคูลัสเบื้องต้น ฉบับปรับปรุง','รศ.ดร. สมชาย ผลดี','สำนักพิมพ์มหาวิทยาลัย',
     380.00, 620, 512, 'textbook',   'stock',    null),
  ('BK-0006','9786160000006','ปลายทางที่ไม่มีชื่อ','ณัฐพงษ์ ศรีวัฒน์','สำนักพิมพ์ใบไม้',
     320.00, 380, 320, 'literature', 'preorder', current_date + 45),
  ('BK-0007','9786160000007','ตำนานเมืองเก่าที่ถูกลืม','วิชัย บุญมาก','สำนักพิมพ์อักษร',
     390.00, 450, 380, 'history',    'stock',    null)
) as v(sku, isbn, title, author, publisher, price, weight, pages, cat, mode, release_date)
join public.categories c on c.slug = v.cat
on conflict (sku) do nothing;

-- ---------- 4. รับเข้า 2 ล็อต ต้นทุนต่างกัน เพื่อให้เห็นการทำงานของ FIFO ----------
do $$
declare v_book uuid;
begin
  select id into v_book from public.books where sku = 'BK-0001';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    -- ล็อต A: 20 เล่ม @120 + ค่าส่งขาเข้า 200  ->  ต้นทุนจริง 130.00/เล่ม
    perform public.fn_receive_stock(v_book, 20, 120, 200, 'ตัวแทนจำหน่าย ก',
                                    current_date - 30, 'PO-1001', 'LOT-A');
    -- ล็อต B: 30 เล่ม @115 + ค่าส่งขาเข้า 150  ->  ต้นทุนจริง 120.00/เล่ม
    perform public.fn_receive_stock(v_book, 30, 115, 150, 'ตัวแทนจำหน่าย ก',
                                    current_date - 10, 'PO-1042', 'LOT-B');
  end if;

  select id into v_book from public.books where sku = 'BK-0003';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(v_book, 15, 105, 120, 'ตัวแทนจำหน่าย ข',
                                    current_date - 20, 'PO-1015', 'LOT-C');
  end if;

  -- เล่มนี้ตั้งใจให้รับเข้ามานานแล้วและไม่เคยขายเลย
  -- เพื่อให้เห็นรายงาน "ค้างสต็อกเกิน 90 วัน" ทำงานจริง
  select id into v_book from public.books where sku = 'BK-0007';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(v_book, 8, 250, 80, 'ตัวแทนจำหน่าย ง',
                                    current_date - 220, 'PO-0801', 'LOT-E');
  end if;

  -- เล่มนี้ตั้งใจให้เหลือน้อย เพื่อให้เห็นการแจ้งเตือน "ต้องสั่งเพิ่ม" บนหน้าภาพรวม
  select id into v_book from public.books where sku = 'BK-0004';
  if v_book is not null and not exists (select 1 from public.purchase_lots where book_id = v_book) then
    perform public.fn_receive_stock(v_book, 2, 210, 40, 'ตัวแทนจำหน่าย ค',
                                    current_date - 60, 'PO-0990', 'LOT-D');
  end if;
end $$;
