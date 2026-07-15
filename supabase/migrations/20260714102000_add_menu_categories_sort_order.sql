alter table public.menu_categories
  add column if not exists sort_order integer not null default 0;

with ordered as (
  select id, row_number() over (partition by tenant_id order by name asc) - 1 as next_order
  from public.menu_categories
)
update public.menu_categories mc
set sort_order = ordered.next_order
from ordered
where ordered.id = mc.id;

create index if not exists idx_menu_categories_tenant_sort
  on public.menu_categories (tenant_id, sort_order);
