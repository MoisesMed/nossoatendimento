alter table public.menu_items
  add column if not exists visible_in_menu_updated_at timestamptz;

alter table public.menu_categories
  add column if not exists visible_in_menu_updated_at timestamptz;

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
  category_sort_order integer
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
    coalesce(mc.sort_order, 9999) as category_sort_order
  from public.tenants t
  join public.menu_items mi
    on mi.tenant_id = t.id
   and mi.active = true
   and (mi.visible_in_menu = true or mi.visible_in_menu_updated_at is null)
  left join public.menu_categories mc
    on mc.tenant_id = t.id
   and mc.name = mi.category
   and mc.active = true
   and (mc.visible_in_menu = true or mc.visible_in_menu_updated_at is null)
  where t.slug = lower(trim(p_tenant_slug))
  order by coalesce(mc.sort_order, 9999), mi.category asc, mi.name asc;
$$;
