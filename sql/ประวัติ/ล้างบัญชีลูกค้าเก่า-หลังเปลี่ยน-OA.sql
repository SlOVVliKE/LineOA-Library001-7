-- ============================================================
--  ล้างบัญชีลูกค้าที่ผูกกับ LINE OA เดิม
--
--  ทำไมต้องล้าง
--  LINE ออก user ID แยกตาม provider พอเปลี่ยน OA ไปอยู่ provider ใหม่
--  ลูกค้าคนเดิมจะได้ ID ใหม่ตอนล็อกอินผ่าน LIFF ใหม่ กลายเป็นสองบัญชี
--  บัญชีเก่าถือดาวและออเดอร์ไว้ แต่ ID ใช้ส่งข้อความไม่ได้แล้ว
--  ระบบจึงพยายามส่งแล้วได้ LINE API 400 ซ้ำๆ ตลอดไป
--
--  ตัวชี้เป้า: line_user_id ขึ้นต้นด้วย 'Ud1538' และสร้างก่อน 20 ส.ค. 2569
--  (จงใจไม่เขียน LINE user ID เต็มลงไฟล์นี้ เพราะไฟล์นี้ขึ้น git)
--
--  วิธีใช้: รัน PART 1 ก่อน แล้วค่อยรัน PART 2
-- ============================================================


-- ============================================================
--  PART 1 — ดูก่อนว่าจะกระทบอะไร (ไม่แก้อะไรทั้งสิ้น)
-- ============================================================

-- 1.1 บัญชีที่จะถูกลบ กับบัญชีใหม่ที่จะอยู่ต่อ
select u.display_name as ชื่อ,
       left(u.line_user_id,6)||'...'||right(u.line_user_id,4) as line_id_ย่อ,
       (u.created_at at time zone 'Asia/Bangkok')::date as สร้างเมื่อ,
       case when u.line_user_id like 'Ud1538%' then '>>> จะถูกลบ <<<'
            else 'อยู่ต่อ' end as สถานะ
from public.users u
where u.line_user_id is not null
order by u.created_at;

-- 1.2 นับของที่จะหายไปพร้อมบัญชีเก่า
select
  (select count(*) from public.notifications n join public.users u on u.id=n.user_id
     where u.line_user_id like 'Ud1538%')      as แจ้งเตือนที่จะหาย,
  (select count(*) from public.book_favourites f join public.users u on u.id=f.user_id
     where u.line_user_id like 'Ud1538%')      as ดาวที่จะหาย,
  (select count(*) from public.addresses a join public.users u on u.id=a.user_id
     where u.line_user_id like 'Ud1538%')      as ที่อยู่ที่จะหาย;

-- 1.3 ออเดอร์ที่จะกลายเป็นไม่มีเจ้าของ (ไม่ถูกลบ — FK เป็น SET NULL)
select o.order_no, o.status, o.total,
       o.shipping_address->>'recipient_name' as ชื่อผู้รับ_ยังอยู่
from public.orders o join public.users u on u.id=o.user_id
where u.line_user_id like 'Ud1538%'
order by o.order_no;

-- 1.4 ยอดขายรวมก่อนล้าง — ต้องเท่าเดิมหลังล้าง
select count(*) as จำนวนออเดอร์, sum(total) as ยอดขาย
from public.orders where status not in ('cancelled','pending_payment');


-- ============================================================
--  PART 2 — ล้างจริง  (คัดลอกตั้งแต่ BEGIN ถึง COMMIT ไปรัน)
-- ============================================================
/*
BEGIN;

-- กันพลาด: ถ้าหาบัญชีเก่าไม่เจอ หรือเจอมากกว่า 1 ให้หยุดทันที
-- ไม่ยอมให้คำสั่งลบทำงานแบบเดาสุ่ม
do $$
declare n int;
begin
  select count(*) into n from public.users
  where line_user_id like 'Ud1538%'
    and created_at < '2026-08-20';

  if n <> 1 then
    raise exception 'หยุด: เจอบัญชีเก่า % รายการ (ต้องเจอ 1 เท่านั้น) ตรวจ PART 1 ก่อน', n;
  end if;
end $$;

-- ลบบัญชีเก่า
-- addresses / book_favourites / cart / notifications / user_roles = CASCADE ตามไปเอง
-- orders.user_id = SET NULL ออเดอร์จึงยังอยู่ครบ
delete from public.users
where line_user_id like 'Ud1538%'
  and created_at < '2026-08-20';

-- ลบบัญชี auth ที่คู่กัน ไม่งั้นจะเหลือบัญชีล็อกอินที่ไม่มีตัวตนในระบบ
-- (users.auth_user_id ถูกลบไปพร้อมแถวข้างบนแล้ว จึงต้องกวาดตาม email แทน)
delete from auth.users
where email like 'ud1538%@line.local';

COMMIT;
*/


-- ============================================================
--  PART 3 — ตรวจหลังล้าง
-- ============================================================
/*
-- ควรเหลือแค่บัญชีที่สร้าง 31 ส.ค. เป็นต้นไป
select display_name as ชื่อ,
       left(line_user_id,6)||'...'||right(line_user_id,4) as line_id_ย่อ,
       (created_at at time zone 'Asia/Bangkok')::date as สร้างเมื่อ
from public.users where line_user_id is not null order by created_at;

-- ยอดขายต้องเท่าเดิมทุกบาท — ถ้าเปลี่ยนแปลว่ามีอะไรผิด
select count(*) as จำนวนออเดอร์, sum(total) as ยอดขาย
from public.orders where status not in ('cancelled','pending_payment');

-- ออเดอร์เก่าควรยังอยู่ แต่ user_id ว่าง
select order_no, status, total, (user_id is null) as ไม่มีเจ้าของแล้ว
from public.orders order by order_no;

-- ไม่ควรมีแจ้งเตือนค้างสถานะ failed/pending อีก
select status, count(*) from public.notifications group by status;
*/


-- ============================================================
--  หมายเหตุสำหรับอนาคต
--
--  ถ้าวันหน้าเปลี่ยน OA อีก ปัญหานี้จะกลับมา และตอนนั้นอาจมีลูกค้า
--  หลายร้อยคน การล้างทิ้งจะไม่ใช่ทางเลือกอีกต่อไป
--
--  ทางกันคือเก็บตัวระบุตัวตนที่ไม่ผูกกับ LINE ไว้ด้วย เช่นเบอร์โทร
--  ที่ลูกค้ากรอกตอน checkout อยู่แล้ว จะได้จับคู่บัญชีเก่ากับใหม่ได้
--  โดยไม่ต้องพึ่ง LINE user ID อย่างเดียว
-- ============================================================
