alter table public.tenants
  add column if not exists logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-logos',
  'restaurant-logos',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

drop policy if exists restaurant_logos_insert on storage.objects;
create policy restaurant_logos_insert
  on storage.objects
  for insert
  with check (
    bucket_id = 'restaurant-logos'
    and exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.active = true
        and m.tenant_id::text = split_part(name, '/', 1)
        and m.role = 'DONO'
    )
  );

drop policy if exists restaurant_logos_update on storage.objects;
create policy restaurant_logos_update
  on storage.objects
  for update
  using (
    bucket_id = 'restaurant-logos'
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
    bucket_id = 'restaurant-logos'
    and exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.active = true
        and m.tenant_id::text = split_part(name, '/', 1)
        and m.role = 'DONO'
    )
  );

drop policy if exists restaurant_logos_delete on storage.objects;
create policy restaurant_logos_delete
  on storage.objects
  for delete
  using (
    bucket_id = 'restaurant-logos'
    and exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.active = true
        and m.tenant_id::text = split_part(name, '/', 1)
        and m.role = 'DONO'
    )
  );
