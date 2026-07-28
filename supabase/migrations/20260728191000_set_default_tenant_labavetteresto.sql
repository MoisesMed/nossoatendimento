create or replace function public.ensure_default_membership()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  resolved_slug text;
  resolved_tenant_id uuid;
  resolved_email text;
  resolved_phone text;
  resolved_full_name text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return false;
  end if;

  select
    coalesce(nullif(lower(trim(u.raw_user_meta_data ->> 'tenant_slug')), ''), 'labavetteresto'),
    lower(trim(u.email)),
    regexp_replace(coalesce(u.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g'),
    coalesce(trim(u.raw_user_meta_data ->> 'full_name'), '')
  into
    resolved_slug,
    resolved_email,
    resolved_phone,
    resolved_full_name
  from auth.users u
  where u.id = current_user_id;

  select t.id
    into resolved_tenant_id
  from public.tenants t
  where lower(t.slug) = resolved_slug
  limit 1;

  if resolved_tenant_id is null then
    select t.id
      into resolved_tenant_id
    from public.tenants t
    where lower(t.slug) = 'labavetteresto'
    limit 1;
  end if;

  if resolved_tenant_id is null then
    return false;
  end if;

  insert into public.memberships (tenant_id, user_id, role, active)
  values (resolved_tenant_id, current_user_id, 'USUARIO', true)
  on conflict (tenant_id, user_id)
  do update set active = true;

  begin
    insert into public.tenant_user_profiles (tenant_id, user_id, email, phone, full_name)
    values (resolved_tenant_id, current_user_id, resolved_email, resolved_phone, resolved_full_name)
    on conflict (tenant_id, user_id)
    do update set
      email = excluded.email,
      phone = excluded.phone,
      full_name = excluded.full_name,
      updated_at = timezone('utc', now());
  exception
    when unique_violation then
      null;
  end;

  return true;
end;
$$;

drop function if exists public.get_public_tenant(text);

create or replace function public.get_public_tenant(
  p_tenant_slug text default 'labavetteresto'
)
returns table (
  name text,
  theme jsonb,
  logo_path text
)
language sql
security definer
set search_path = public
as $$
  select t.name, t.theme, t.logo_path
  from public.tenants t
  where t.slug = lower(trim(p_tenant_slug))
  limit 1;
$$;

revoke all on function public.get_public_tenant(text) from public;
grant execute on function public.get_public_tenant(text) to anon, authenticated;

drop function if exists public.get_public_menu(text);

create or replace function public.get_public_menu(
  p_tenant_slug text default 'labavetteresto'
)
returns table (
  id uuid,
  code integer,
  name text,
  category text,
  description text,
  price numeric,
  promotional_price numeric,
  serves_people integer,
  active boolean,
  image_path text,
  image_url text,
  category_sort_order integer,
  category_image_path text
)
language sql
security definer
set search_path = public
as $$
  select
    mi.id,
    mi.code,
    mi.name,
    mi.category,
    mi.description,
    mi.price,
    mi.promotional_price,
    mi.serves_people,
    mi.active,
    mi.image_path,
    null::text as image_url,
    coalesce(mc.sort_order, 9999) as category_sort_order,
    mc.image_path as category_image_path
  from public.tenants t
  join public.menu_items mi
    on mi.tenant_id = t.id
   and mi.active = true
  left join public.menu_categories mc
    on mc.tenant_id = t.id
   and mc.name = mi.category
   and mc.active = true
  where t.slug = lower(trim(p_tenant_slug))
  order by coalesce(mc.sort_order, 9999), mi.category asc, mi.name asc;
$$;

revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;

drop function if exists public.get_public_menu_additionals(text);

create or replace function public.get_public_menu_additionals(
  p_tenant_slug text default 'labavetteresto'
)
returns table (
  id uuid,
  menu_item_id uuid,
  item_name text,
  title text,
  description text,
  price numeric,
  sort_order integer,
  active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    mia.id,
    mia.menu_item_id,
    mi.name as item_name,
    mia.title,
    mia.description,
    mia.price,
    mia.sort_order,
    mia.active
  from public.tenants t
  join public.menu_item_additionals mia
    on mia.tenant_id = t.id
   and mia.active = true
  left join public.menu_items mi
    on mi.id = mia.menu_item_id
   and mi.tenant_id = t.id
  where t.slug = lower(trim(p_tenant_slug))
  order by mia.sort_order asc, mia.title asc;
$$;

revoke all on function public.get_public_menu_additionals(text) from public;
grant execute on function public.get_public_menu_additionals(text) to anon, authenticated;
