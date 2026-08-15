-- ============================================================
-- 0020  ยืนยันการชำระเงินอัตโนมัติจากผลตรวจสลิป
--
-- ทำไมต้องเป็นฟังก์ชันในฐานข้อมูล ไม่ใช่โค้ดในแอป:
-- ขั้นตอนนี้แตะเงินและสต็อกพร้อมกัน — บันทึกผลตรวจ, ตัดสต็อก FIFO,
-- ล็อกต้นทุน, ออกใบเสร็จ ถ้าทำทีละคำสั่งจากฝั่งแอปแล้วเน็ตหลุดกลางทาง
-- จะได้สถานะครึ่งๆ กลางๆ เช่นเงินยืนยันแล้วแต่สต็อกไม่ถูกตัด
-- ในฟังก์ชันเดียวทุกอย่างอยู่ใน transaction เดียว ล้มก็ย้อนคืนทั้งหมด
-- ============================================================

-- เก็บรหัสธุรกรรมจากธนาคารไว้กันสลิปซ้ำอีกชั้นในฝั่งเรา
-- Slip2Go มี checkDuplicate ให้แล้ว แต่ผูกกับบัญชี Slip2Go
-- ถ้าวันหนึ่งย้ายผู้ให้บริการ ข้อมูลกันซ้ำจะหายไปด้วย จึงเก็บไว้เองด้วย
comment on column public.payments.slip_ref is
  'รหัสอ้างอิงธุรกรรมจากธนาคาร (transRef) — unique เพื่อกันสลิปใบเดิมถูกใช้ซ้ำ';

create or replace function public.fn_auto_confirm_slip(
  p_payment_id uuid,
  p_trans_ref  text,
  p_payload    jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_purpose  text;
  v_status   text;
  v_existing uuid;
begin
  select p.order_id, p.purpose, o.status
    into v_order_id, v_purpose, v_status
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.id = p_payment_id;

  if v_order_id is null then
    raise exception 'ไม่พบรายการชำระเงิน';
  end if;

  -- กันสลิปซ้ำ: ถ้ารหัสธุรกรรมนี้เคยถูกใช้กับรายการอื่นแล้ว ให้ปฏิเสธ
  -- ตรวจก่อน update เพื่อให้ได้ข้อความที่อ่านรู้เรื่อง แทน unique violation ดิบๆ
  if p_trans_ref is not null then
    select id into v_existing
    from public.payments
    where slip_ref = p_trans_ref and id <> p_payment_id
    limit 1;

    if v_existing is not null then
      update public.payments
         set verify_status = 'rejected',
             verify_payload = p_payload,
             verified_at = now()
       where id = p_payment_id;
      return 'duplicate';
    end if;
  end if;

  update public.payments
     set verify_status = 'auto_verified',
         slip_ref      = coalesce(p_trans_ref, slip_ref),
         verify_payload = p_payload,
         verified_at   = now()
   where id = p_payment_id;

  -- ยืนยันเงินตามชนิดของการชำระ
  -- สลิป "ส่วนที่เหลือ" ไม่ต้องตัดสต็อกอีก เพราะตัดไปแล้วตอนจ่ายของตามคิว
  if v_purpose = 'balance' then
    if v_status <> 'awaiting_balance' then
      return 'wrong_status';
    end if;
    perform public.fn_confirm_balance_paid(v_order_id, null);
  else
    if v_status <> 'pending_payment' then
      return 'wrong_status';
    end if;
    perform public.fn_confirm_order_paid(v_order_id, null);
  end if;

  return 'confirmed';
end $$;

revoke execute on function public.fn_auto_confirm_slip(uuid, text, jsonb) from public, anon, authenticated;
grant  execute on function public.fn_auto_confirm_slip(uuid, text, jsonb) to service_role;

-- ---------- บันทึกผลตรวจที่ไม่ผ่าน ----------
-- ไม่ปฏิเสธทิ้งทันที เพราะสลิปอาจไม่ผ่านเพราะเหตุที่ไม่ใช่ความผิดลูกค้า
-- (API ล่ม โควตาหมด รูปเบลอ) จึงคงสถานะ pending ไว้ให้แอดมินตัดสินใจ
-- แต่เก็บผลไว้ให้แอดมินเห็นว่าเครื่องอ่านได้ว่าอะไร
create or replace function public.fn_record_slip_check(
  p_payment_id uuid,
  p_payload    jsonb
) returns void
language sql security definer set search_path = public as $$
  update public.payments
     set verify_payload = p_payload
   where id = p_payment_id;
$$;

revoke execute on function public.fn_record_slip_check(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.fn_record_slip_check(uuid, jsonb) to service_role;
