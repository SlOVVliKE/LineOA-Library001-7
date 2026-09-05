-- เพิ่ม ShipPop เป็นขนส่งที่เลือกได้
--
-- ShipPop ไม่ได้ส่งของเอง แต่เป็นตัวรวมขนส่งหลายเจ้า (ไปรษณีย์ไทย/Flash/J&T/Kerry ฯลฯ)
-- ในตาราง shipments เราจึงบันทึก carrier = shippop แล้วเก็บว่าเจ้าไหนวิ่งจริงไว้ใน
-- raw_response (ผลตอบจาก /booking/) ไม่ต้องแตกเป็นแถว carriers ทีละเจ้า
--
-- is_active = true เพื่อให้เลือกใช้ได้ทันทีหลังใส่ SHIPPOP_API_KEY
-- ถ้ายังไม่ได้ใส่คีย์ ตัว adapter จะโยน error บอกเองว่าต้องตั้งค่าอะไร

insert into carriers (code, name_th, is_active, api_config)
values ('shippop', 'ShipPop', true, '{}'::jsonb)
on conflict (code) do nothing;
