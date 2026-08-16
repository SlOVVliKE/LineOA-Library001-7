-- ============================================================
-- 0021  ปิดช่องโหว่ search_path ในฟังก์ชันที่ยังเหลือ
--
-- Supabase Security Advisor เตือน "Function Search Path Mutable"
-- กับฟังก์ชันที่ไม่ได้ล็อก search_path ไว้
--
-- ทำไมถึงเป็นเรื่อง:
-- ถ้าไม่ล็อก Postgres จะหาชื่อตาราง/ฟังก์ชันตาม search_path ของผู้เรียก
-- ผู้ใช้ที่สร้าง schema ของตัวเองได้ อาจวางตารางชื่อซ้ำไว้ข้างหน้า
-- แล้วทำให้ฟังก์ชันไปอ่าน/เขียนตารางปลอมแทนของจริง
--
-- ความเสี่ยงจริงในระบบเราต่ำ เพราะไม่ได้เปิดให้ใครสร้าง schema
-- แต่การล็อกไม่มีข้อเสีย และทำให้ Advisor เขียวโดยไม่ต้องหลบเลี่ยง
-- ============================================================

-- trigger อัปเดตเวลาแก้ไขล่าสุด ใช้กับเกือบทุกตาราง
create or replace function public.fn_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- เลขที่คำสั่งซื้อ OD-YYYY-NNNNNN
create or replace function public.fn_next_order_no()
returns text language sql volatile set search_path = public as $$
  select 'OD-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.seq_order_no')::text, 6, '0');
$$;

-- เลขที่ใบเสร็จ RC-YYMM-NNNNNN
create or replace function public.fn_next_receipt_no()
returns text language sql volatile set search_path = public as $$
  select 'RC-' || to_char(now(), 'YYMM') || '-' ||
         lpad(nextval('public.seq_receipt_no')::text, 6, '0');
$$;
