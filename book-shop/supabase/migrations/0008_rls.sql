-- ============================================================
-- 0008  Row Level Security
-- หลักการ: ต้นทุนและกำไรเปิดเฉพาะผู้มีสิทธิ์ cost.read
--          บังคับที่ชั้น DB ไม่ใช่แค่ซ่อนปุ่มใน UI
-- ============================================================
alter table public.users               enable row level security;
alter table public.roles               enable row level security;
alter table public.permissions         enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.user_roles          enable row level security;
alter table public.categories          enable row level security;
alter table public.books               enable row level security;
alter table public.purchase_lots       enable row level security;
alter table public.book_units          enable row level security;
alter table public.stock_movements     enable row level security;
alter table public.stock_reservations  enable row level security;
alter table public.channels            enable row level security;
alter table public.channel_listings    enable row level security;
alter table public.sync_jobs           enable row level security;
alter table public.sync_discrepancies  enable row level security;
alter table public.addresses           enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.preorder_queue      enable row level security;
alter table public.receipts            enable row level security;
alter table public.payments            enable row level security;
alter table public.returns             enable row level security;
alter table public.cart                enable row level security;
alter table public.cart_items          enable row level security;
alter table public.carriers            enable row level security;
alter table public.shipments           enable row level security;
alter table public.shipment_events     enable row level security;
alter table public.shipping_rules      enable row level security;

-- ---------- แคตตาล็อก: ใครก็อ่านได้ (หน้าร้าน) ----------
create policy books_public_read on public.books
  for select using (is_active = true or public.fn_has_permission('book.write'));

create policy books_admin_write on public.books
  for all using (public.fn_has_permission('book.write'))
  with check (public.fn_has_permission('book.write'));

create policy categories_public_read on public.categories for select using (true);
create policy categories_admin_write on public.categories
  for all using (public.fn_has_permission('book.write'))
  with check (public.fn_has_permission('book.write'));

create policy shipping_rules_read on public.shipping_rules for select using (true);
create policy carriers_read on public.carriers for select using (true);

-- ---------- ต้นทุน: ปิดสนิท เปิดเฉพาะ cost.read / lot.write ----------
create policy lots_read on public.purchase_lots
  for select using (public.fn_has_permission('cost.read'));
create policy lots_write on public.purchase_lots
  for all using (public.fn_has_permission('lot.write'))
  with check (public.fn_has_permission('lot.write'));

create policy movements_read on public.stock_movements
  for select using (public.fn_has_permission('cost.read') or public.fn_has_permission('lot.write'));
create policy movements_write on public.stock_movements
  for all using (public.fn_has_permission('lot.write'))
  with check (public.fn_has_permission('lot.write'));

create policy units_read on public.book_units
  for select using (public.fn_has_permission('order.read'));
create policy units_write on public.book_units
  for all using (public.fn_has_permission('lot.write'))
  with check (public.fn_has_permission('lot.write'));

-- ---------- ผู้ใช้ ----------
create policy users_self_read on public.users
  for select using (auth_user_id = auth.uid() or public.fn_has_permission('user.manage'));
create policy users_self_update on public.users
  for update using (auth_user_id = auth.uid() or public.fn_has_permission('user.manage'));
create policy users_admin_all on public.users
  for all using (public.fn_has_permission('user.manage'))
  with check (public.fn_has_permission('user.manage'));

create policy roles_read on public.roles for select using (true);
create policy permissions_read on public.permissions for select using (true);
create policy role_perms_read on public.role_permissions for select using (true);
create policy user_roles_read on public.user_roles
  for select using (
    user_id = public.fn_current_user_id() or public.fn_has_permission('user.manage'));
create policy user_roles_write on public.user_roles
  for all using (public.fn_has_permission('user.manage'))
  with check (public.fn_has_permission('user.manage'));

-- ---------- ออเดอร์: ลูกค้าเห็นของตัวเอง แอดมินเห็นทั้งหมด ----------
create policy orders_owner_read on public.orders
  for select using (
    user_id = public.fn_current_user_id() or public.fn_has_permission('order.read'));
create policy orders_admin_write on public.orders
  for all using (public.fn_has_permission('order.read'))
  with check (public.fn_has_permission('order.read'));

create policy items_read on public.order_items
  for select using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id = public.fn_current_user_id() or public.fn_has_permission('order.read'))));
create policy items_admin_write on public.order_items
  for all using (public.fn_has_permission('order.read'))
  with check (public.fn_has_permission('order.read'));

create policy addresses_owner on public.addresses
  for all using (user_id = public.fn_current_user_id() or public.fn_has_permission('order.read'))
  with check (user_id = public.fn_current_user_id() or public.fn_has_permission('order.read'));

create policy cart_owner on public.cart
  for all using (user_id = public.fn_current_user_id())
  with check (user_id = public.fn_current_user_id());
create policy cart_items_owner on public.cart_items
  for all using (exists (
    select 1 from public.cart c where c.id = cart_id and c.user_id = public.fn_current_user_id()))
  with check (exists (
    select 1 from public.cart c where c.id = cart_id and c.user_id = public.fn_current_user_id()));

create policy receipts_read on public.receipts
  for select using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id = public.fn_current_user_id() or public.fn_has_permission('order.read'))));
create policy receipts_write on public.receipts
  for all using (public.fn_has_permission('receipt.issue'))
  with check (public.fn_has_permission('receipt.issue'));

create policy payments_read on public.payments
  for select using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id = public.fn_current_user_id() or public.fn_has_permission('order.read'))));
create policy payments_write on public.payments
  for all using (public.fn_has_permission('payment.verify'))
  with check (public.fn_has_permission('payment.verify'));

create policy returns_admin on public.returns
  for all using (public.fn_has_permission('order.read'))
  with check (public.fn_has_permission('order.read'));

create policy preorder_read on public.preorder_queue
  for select using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id = public.fn_current_user_id() or public.fn_has_permission('order.read'))));
create policy preorder_write on public.preorder_queue
  for all using (public.fn_has_permission('order.read'))
  with check (public.fn_has_permission('order.read'));

create policy reservations_admin on public.stock_reservations
  for all using (public.fn_has_permission('order.read'))
  with check (public.fn_has_permission('order.read'));

-- ---------- ขนส่ง ----------
create policy shipments_read on public.shipments
  for select using (exists (
    select 1 from public.orders o where o.id = order_id
      and (o.user_id = public.fn_current_user_id() or public.fn_has_permission('order.read'))));
create policy shipments_write on public.shipments
  for all using (public.fn_has_permission('order.ship'))
  with check (public.fn_has_permission('order.ship'));
create policy ship_events_read on public.shipment_events
  for select using (exists (
    select 1 from public.shipments s
    join public.orders o on o.id = s.order_id
    where s.id = shipment_id
      and (o.user_id = public.fn_current_user_id()
           or public.fn_has_permission('order.read'))));
create policy ship_events_write on public.shipment_events
  for all using (public.fn_has_permission('order.ship'))
  with check (public.fn_has_permission('order.ship'));

-- ---------- ช่องทางขาย ----------
create policy channels_read on public.channels
  for select using (public.fn_has_permission('order.read'));
create policy channels_write on public.channels
  for all using (public.fn_has_permission('channel.manage'))
  with check (public.fn_has_permission('channel.manage'));
create policy listings_all on public.channel_listings
  for all using (public.fn_has_permission('channel.manage'))
  with check (public.fn_has_permission('channel.manage'));
create policy syncjobs_all on public.sync_jobs
  for all using (public.fn_has_permission('channel.manage'))
  with check (public.fn_has_permission('channel.manage'));
create policy discrepancies_all on public.sync_discrepancies
  for all using (public.fn_has_permission('channel.manage'))
  with check (public.fn_has_permission('channel.manage'));

-- ---------- สิทธิ์เรียกฟังก์ชัน ----------
revoke execute on function public.fn_receive_stock(uuid,int,numeric,numeric,text,date,text,text,text,uuid) from public, anon;
revoke execute on function public.fn_consume_stock_fifo(uuid,int,uuid,uuid,text,text) from public, anon;
revoke execute on function public.fn_adjust_stock(uuid,int,text,text,uuid) from public, anon;
revoke execute on function public.fn_confirm_order_paid(uuid,uuid) from public, anon;

grant execute on function public.fn_receive_stock(uuid,int,numeric,numeric,text,date,text,text,text,uuid) to authenticated, service_role;
grant execute on function public.fn_consume_stock_fifo(uuid,int,uuid,uuid,text,text) to authenticated, service_role;
grant execute on function public.fn_adjust_stock(uuid,int,text,text,uuid) to authenticated, service_role;
grant execute on function public.fn_confirm_order_paid(uuid,uuid) to authenticated, service_role;
