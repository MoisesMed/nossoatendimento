create table if not exists public.menu_item_additionals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  title text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, menu_item_id, title)
);

create index if not exists idx_menu_item_additionals_tenant_active
  on public.menu_item_additionals (tenant_id, active, sort_order, title);

create index if not exists idx_menu_item_additionals_tenant_item
  on public.menu_item_additionals (tenant_id, menu_item_id);

drop trigger if exists trg_menu_item_additionals_updated_at on public.menu_item_additionals;
create trigger trg_menu_item_additionals_updated_at
before update on public.menu_item_additionals
for each row
execute function public.touch_updated_at();

alter table public.menu_item_additionals enable row level security;
alter table public.menu_item_additionals force row level security;

drop policy if exists menu_item_additionals_select_usuario on public.menu_item_additionals;
create policy menu_item_additionals_select_usuario
  on public.menu_item_additionals
  for select
  using (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists menu_item_additionals_insert_atendente on public.menu_item_additionals;
create policy menu_item_additionals_insert_atendente
  on public.menu_item_additionals
  for insert
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists menu_item_additionals_update_atendente on public.menu_item_additionals;
create policy menu_item_additionals_update_atendente
  on public.menu_item_additionals
  for update
  using (app.has_min_role(tenant_id, 'ATENDENTE'))
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists menu_item_additionals_delete_atendente on public.menu_item_additionals;
create policy menu_item_additionals_delete_atendente
  on public.menu_item_additionals
  for delete
  using (app.has_min_role(tenant_id, 'ATENDENTE'));

grant select, insert, update, delete on public.menu_item_additionals to authenticated;

drop function if exists public.get_public_menu_additionals(text);

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
  where t.slug = lower(trim(p_tenant_slug))
  order by mia.sort_order asc, mia.title asc;
$$;

revoke all on function public.get_public_menu_additionals(text) from public;
grant execute on function public.get_public_menu_additionals(text) to anon, authenticated;
