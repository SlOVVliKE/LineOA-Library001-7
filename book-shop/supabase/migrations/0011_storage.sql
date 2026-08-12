-- ============================================================
-- 0011  ที่เก็บไฟล์: สลิปโอนเงิน และรูปปกหนังสือ
-- ============================================================

-- สลิปเป็นข้อมูลส่วนบุคคล ต้องเป็น bucket ปิด เข้าถึงผ่าน signed URL เท่านั้น
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slips', 'slips', false, 5242880,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- รูปปกเปิดสาธารณะได้ ไม่มีข้อมูลอ่อนไหว
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- ---------- สลิป ----------
-- ลูกค้าอัปโหลดได้เฉพาะโฟลเดอร์ของออเดอร์ตัวเอง: slips/<order_id>/<ไฟล์>
create policy "ลูกค้าอัปโหลดสลิปของออเดอร์ตัวเองได้"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'slips'
  and exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[1]
      and o.user_id = public.fn_current_user_id()
  )
);

create policy "ลูกค้าดูสลิปของตัวเองได้ แอดมินดูได้ทั้งหมด"
on storage.objects for select to authenticated
using (
  bucket_id = 'slips'
  and (
    public.fn_has_permission('payment.verify')
    or exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.user_id = public.fn_current_user_id()
    )
  )
);

-- ---------- รูปปก ----------
create policy "ใครก็ดูรูปปกได้"
on storage.objects for select to public
using (bucket_id = 'covers');

create policy "คนจัดการหนังสือแก้รูปปกได้"
on storage.objects for all to authenticated
using (bucket_id = 'covers' and public.fn_has_permission('book.write'))
with check (bucket_id = 'covers' and public.fn_has_permission('book.write'));
