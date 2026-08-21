-- Defense in depth hardening for role permissions.
-- Goal: ATENDENTE operational on mesas only, DONO required for admin/cardapio writes.

-- 1) Menu items: keep read for USUARIO+, restrict writes to DONO.
drop policy if exists menu_items_insert_atendente on public.menu_items;
drop policy if exists menu_items_update_atendente on public.menu_items;
drop policy if exists menu_items_delete_atendente on public.menu_items;
drop policy if exists menu_items_insert_dono on public.menu_items;
drop policy if exists menu_items_update_dono on public.menu_items;
drop policy if exists menu_items_delete_dono on public.menu_items;

create policy menu_items_insert_dono
  on public.menu_items
  for insert
  with check (app.has_min_role(tenant_id, 'DONO'));

create policy menu_items_update_dono
  on public.menu_items
  for update
  using (app.has_min_role(tenant_id, 'DONO'))
  with check (app.has_min_role(tenant_id, 'DONO'));

create policy menu_items_delete_dono
  on public.menu_items
  for delete
  using (app.has_min_role(tenant_id, 'DONO'));

-- 2) Menu categories: restrict writes to DONO.
drop policy if exists menu_categories_insert_atendente on public.menu_categories;
drop policy if exists menu_categories_update_atendente on public.menu_categories;
drop policy if exists menu_categories_delete_atendente on public.menu_categories;
drop policy if exists menu_categories_insert_dono on public.menu_categories;
drop policy if exists menu_categories_update_dono on public.menu_categories;
drop policy if exists menu_categories_delete_dono on public.menu_categories;

create policy menu_categories_insert_dono
  on public.menu_categories
  for insert
  with check (app.has_min_role(tenant_id, 'DONO'));

create policy menu_categories_update_dono
  on public.menu_categories
  for update
  using (app.has_min_role(tenant_id, 'DONO'))
  with check (app.has_min_role(tenant_id, 'DONO'));

create policy menu_categories_delete_dono
  on public.menu_categories
  for delete
  using (app.has_min_role(tenant_id, 'DONO'));

-- 3) Menu additionals: restrict writes to DONO.
drop policy if exists menu_item_additionals_insert_atendente on public.menu_item_additionals;
drop policy if exists menu_item_additionals_update_atendente on public.menu_item_additionals;
drop policy if exists menu_item_additionals_delete_atendente on public.menu_item_additionals;
drop policy if exists menu_item_additionals_insert_dono on public.menu_item_additionals;
drop policy if exists menu_item_additionals_update_dono on public.menu_item_additionals;
drop policy if exists menu_item_additionals_delete_dono on public.menu_item_additionals;

create policy menu_item_additionals_insert_dono
  on public.menu_item_additionals
  for insert
  with check (app.has_min_role(tenant_id, 'DONO'));

create policy menu_item_additionals_update_dono
  on public.menu_item_additionals
  for update
  using (app.has_min_role(tenant_id, 'DONO'))
  with check (app.has_min_role(tenant_id, 'DONO'));

create policy menu_item_additionals_delete_dono
  on public.menu_item_additionals
  for delete
  using (app.has_min_role(tenant_id, 'DONO'));

-- 4) Storage objects for menu images: restrict writes to DONO.
drop policy if exists menu_item_images_insert on storage.objects;
drop policy if exists menu_item_images_update on storage.objects;
drop policy if exists menu_item_images_delete on storage.objects;

create policy menu_item_images_insert
  on storage.objects
  for insert
  with check (
    bucket_id = 'menu-item-images'
    and exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.active = true
        and m.tenant_id::text = split_part(name, '/', 1)
        and m.role = 'DONO'
    )
  );

create policy menu_item_images_update
  on storage.objects
  for update
  using (
    bucket_id = 'menu-item-images'
    and exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.active = true
        and m.tenant_id::text = split_part(name, '/', 1)
        and m.role = 'DONO'
    )
  )
  with check (
    bucket_id = 'menu-item-images'
    and exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.active = true
        and m.tenant_id::text = split_part(name, '/', 1)
        and m.role = 'DONO'
    )
  );

create policy menu_item_images_delete
  on storage.objects
  for delete
  using (
    bucket_id = 'menu-item-images'
    and exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.active = true
        and m.tenant_id::text = split_part(name, '/', 1)
        and m.role = 'DONO'
    )
  );

-- 5) Mesas: only ATENDENTE+DONO can access/mutate.
drop policy if exists restaurant_tables_select_staff on public.restaurant_tables;
drop policy if exists restaurant_tables_insert_staff on public.restaurant_tables;
drop policy if exists restaurant_tables_update_staff on public.restaurant_tables;
drop policy if exists restaurant_tables_delete_admin on public.restaurant_tables;
drop policy if exists restaurant_tables_select_atendente on public.restaurant_tables;
drop policy if exists restaurant_tables_insert_atendente on public.restaurant_tables;
drop policy if exists restaurant_tables_update_atendente on public.restaurant_tables;
drop policy if exists restaurant_tables_delete_atendente on public.restaurant_tables;

create policy restaurant_tables_select_atendente
  on public.restaurant_tables
  for select
  using (app.has_min_role(tenant_id, 'ATENDENTE'));

create policy restaurant_tables_insert_atendente
  on public.restaurant_tables
  for insert
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

create policy restaurant_tables_update_atendente
  on public.restaurant_tables
  for update
  using (app.has_min_role(tenant_id, 'ATENDENTE'))
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

create policy restaurant_tables_delete_atendente
  on public.restaurant_tables
  for delete
  using (app.has_min_role(tenant_id, 'ATENDENTE'));

-- 6) Itens de mesa: only ATENDENTE+DONO can access/mutate.
drop policy if exists restaurant_table_items_select_staff on public.restaurant_table_items;
drop policy if exists restaurant_table_items_insert_staff on public.restaurant_table_items;
drop policy if exists restaurant_table_items_update_staff on public.restaurant_table_items;
drop policy if exists restaurant_table_items_delete_staff on public.restaurant_table_items;
drop policy if exists restaurant_table_items_select_atendente on public.restaurant_table_items;
drop policy if exists restaurant_table_items_insert_atendente on public.restaurant_table_items;
drop policy if exists restaurant_table_items_update_atendente on public.restaurant_table_items;
drop policy if exists restaurant_table_items_delete_atendente on public.restaurant_table_items;

create policy restaurant_table_items_select_atendente
  on public.restaurant_table_items
  for select
  using (app.has_min_role(tenant_id, 'ATENDENTE'));

create policy restaurant_table_items_insert_atendente
  on public.restaurant_table_items
  for insert
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

create policy restaurant_table_items_update_atendente
  on public.restaurant_table_items
  for update
  using (app.has_min_role(tenant_id, 'ATENDENTE'))
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

create policy restaurant_table_items_delete_atendente
  on public.restaurant_table_items
  for delete
  using (app.has_min_role(tenant_id, 'ATENDENTE'));

-- 7) Tenant and identity admin scopes: DONO-only.
drop policy if exists tenants_update_admin on public.tenants;
create policy tenants_update_admin
  on public.tenants
  for update
  using (app.has_min_role(id, 'DONO'))
  with check (app.has_min_role(id, 'DONO'));

drop policy if exists memberships_select_self_or_admin on public.memberships;
create policy memberships_select_self_or_admin
  on public.memberships
  for select
  using (user_id = auth.uid() or app.has_min_role(tenant_id, 'DONO'));

drop policy if exists memberships_insert_admin on public.memberships;
create policy memberships_insert_admin
  on public.memberships
  for insert
  with check (app.has_min_role(tenant_id, 'DONO'));

drop policy if exists memberships_update_admin on public.memberships;
create policy memberships_update_admin
  on public.memberships
  for update
  using (app.has_min_role(tenant_id, 'DONO'))
  with check (app.has_min_role(tenant_id, 'DONO'));

drop policy if exists tenant_user_profiles_select_self_or_admin on public.tenant_user_profiles;
create policy tenant_user_profiles_select_self_or_admin
  on public.tenant_user_profiles
  for select
  using (user_id = auth.uid() or app.has_min_role(tenant_id, 'DONO'));

drop policy if exists tenant_user_profiles_update_admin on public.tenant_user_profiles;
create policy tenant_user_profiles_update_admin
  on public.tenant_user_profiles
  for update
  using (app.has_min_role(tenant_id, 'DONO'))
  with check (app.has_min_role(tenant_id, 'DONO'));

-- 8) Audit logs read scope: DONO-only.
drop policy if exists audit_logs_select_atendente on public.audit_logs;
drop policy if exists audit_logs_select_dono on public.audit_logs;
create policy audit_logs_select_dono
  on public.audit_logs
  for select
  using (app.has_min_role(tenant_id, 'DONO'));
