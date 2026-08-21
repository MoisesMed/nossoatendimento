alter table public.menu_items
  add column if not exists visible_in_menu boolean not null default true;

alter table public.menu_categories
  add column if not exists visible_in_menu boolean not null default true;

create index if not exists idx_menu_items_tenant_visible_in_menu
  on public.menu_items (tenant_id, visible_in_menu);

create index if not exists idx_menu_categories_tenant_visible_in_menu
  on public.menu_categories (tenant_id, visible_in_menu);

drop function if exists public.get_public_menu(text);

create or replace function public.get_public_menu(
  p_tenant_slug text default 'manja'
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
   and (mi.visible_in_menu = true or mi.visible_in_menu_updated_at is null)
  left join public.menu_categories mc
    on mc.tenant_id = t.id
   and mc.name = mi.category
   and mc.active = true
   and (mc.visible_in_menu = true or mc.visible_in_menu_updated_at is null)
  where t.slug = lower(trim(p_tenant_slug))
  order by coalesce(mc.sort_order, 9999), mi.category asc, mi.name asc;
$$;

create or replace function public.get_public_menu_additionals(
  p_tenant_slug text default 'manja'
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
   and mi.active = true
   and mi.visible_in_menu = true
  where t.slug = lower(trim(p_tenant_slug))
  order by mia.sort_order asc, mia.title asc;
$$;
