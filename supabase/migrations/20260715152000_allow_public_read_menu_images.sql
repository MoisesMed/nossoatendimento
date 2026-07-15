drop policy if exists menu_item_images_select on storage.objects;
create policy menu_item_images_select
  on storage.objects
  for select
  using (
    bucket_id = 'menu-item-images'
    and (
      exists (
        select 1
        from public.memberships m
        where m.user_id = auth.uid()
          and m.active = true
          and m.tenant_id::text = split_part(name, '/', 1)
      )
      or exists (
        select 1
        from public.menu_items mi
        where mi.active = true
          and mi.image_path = name
      )
      or exists (
        select 1
        from public.menu_categories mc
        where mc.active = true
          and mc.image_path = name
      )
    )
  );
