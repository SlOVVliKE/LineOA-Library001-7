-- ============================================================
-- 0019  วิวรวมสำหรับหน้าร้าน + วันที่ของเข้าล่าสุด
--
-- แก้ปัญหา: ปุ่ม "มาใหม่" เรียงตาม books.created_at ซึ่งคือ
-- "วันที่แอดมินเพิ่มหนังสือเข้าระบบ" ไม่ใช่ "วันที่ของเข้าร้าน"
-- หนังสือที่เพิ่มไว้นานแล้วแต่เพิ่งสั่งเข้ามาใหม่จะไม่ขึ้นในหมวดนี้เลย
-- ซึ่งตรงข้ามกับที่ลูกค้าคาดหวังจากคำว่า "มาใหม่"
--
-- ทำไมต้องเป็นวิว: purchase_lots ถูก RLS ปิดไว้ให้เฉพาะคนดูต้นทุนได้
-- ลูกค้าจึงอ่านวันที่รับเข้าตรงๆ ไม่ได้ ต้องผ่านวิวที่เปิดเฉพาะข้อมูลที่ปลอดภัย
-- (ใช้หลักเดียวกับ v_public_stock ที่เปิดเฉพาะ "จำนวนที่ขายได้" โดยไม่เปิดต้นทุน)
--
-- ตั้งใจไม่ใส่ security_invoker เพื่อให้วิวรันด้วยสิทธิ์เจ้าของ
-- แล้วกรอง is_active เองในวิว — วันที่ของเข้าไม่ใช่ข้อมูลอ่อนไหว
-- แต่ต้นทุนและซัพพลายเออร์ในตารางเดียวกันเป็นความลับ จึงไม่ดึงออกมาเด็ดขาด
-- ============================================================

create or replace view public.v_shop_books as
select
  b.id,
  b.sku,
  b.title,
  b.author,
  b.publisher,
  b.isbn,
  b.category_id,
  b.sell_price,
  b.cover_url,
  b.stock_mode,
  b.preorder_release_date,
  b.created_at,
  -- วันที่รับของเข้าล่าสุด ใช้เรียง "มาใหม่"
  -- ถ้ายังไม่เคยรับเข้าเลย (เช่นสินค้าเปิดจอง) ให้ถอยไปใช้วันที่สร้างรายการ
  -- ไม่งั้นสินค้าเปิดจองจะตกไปท้ายสุดตลอดกาลทั้งที่เป็นของใหม่
  coalesce(
    (select max(pl.received_at)::timestamptz
       from public.purchase_lots pl
      where pl.book_id = b.id),
    b.created_at
  ) as last_arrival_at,
  coalesce(vs.available_to_sell, 0) as available_to_sell
from public.books b
left join public.v_public_stock vs on vs.book_id = b.id
where b.is_active;

grant select on public.v_shop_books to anon, authenticated;

-- ช่วยให้ subquery หาวันล่าสุดไม่ต้องสแกนทั้งตาราง
create index if not exists idx_lots_book_received
  on public.purchase_lots (book_id, received_at desc);
