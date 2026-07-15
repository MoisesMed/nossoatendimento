drop function if exists public.get_public_menu(text);

create or replace function public.get_public_menu(
  p_tenant_slug text default 'manja'
)
returns table (
  id uuid,
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
