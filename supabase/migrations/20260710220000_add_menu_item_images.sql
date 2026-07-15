alter table public.menu_items
  add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-item-images',
  'menu-item-images',
  false,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

drop policy if exists menu_item_images_select on storage.objects;
create policy menu_item_images_select
  on storage.objects
  for select
  using (
    bucket_id = 'menu-item-images'
    and exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.active = true
        and m.tenant_id::text = split_part(name, '/', 1)
    )
  );

drop policy if exists menu_item_images_insert on storage.objects;
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
        and m.role in ('ATENDENTE', 'DONO')
    )
  );

drop policy if exists menu_item_images_update on storage.objects;
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
        and m.role in ('ATENDENTE', 'DONO')
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
        and m.role in ('ATENDENTE', 'DONO')
    )
  );

drop policy if exists menu_item_images_delete on storage.objects;
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
        and m.role in ('ATENDENTE', 'DONO')
    )
  );
