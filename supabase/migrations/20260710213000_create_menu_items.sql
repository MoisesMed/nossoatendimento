create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, name)
);

create index if not exists idx_menu_items_tenant_active
  on public.menu_items (tenant_id, active);

create index if not exists idx_menu_items_tenant_name
  on public.menu_items (tenant_id, name);

drop trigger if exists trg_menu_items_updated_at on public.menu_items;
create trigger trg_menu_items_updated_at
before update on public.menu_items
for each row
execute function public.touch_updated_at();

alter table public.menu_items enable row level security;
alter table public.menu_items force row level security;

drop policy if exists menu_items_select_usuario on public.menu_items;
create policy menu_items_select_usuario
  on public.menu_items
  for select
  using (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists menu_items_insert_atendente on public.menu_items;
create policy menu_items_insert_atendente
  on public.menu_items
  for insert
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists menu_items_update_atendente on public.menu_items;
create policy menu_items_update_atendente
  on public.menu_items
  for update
  using (app.has_min_role(tenant_id, 'ATENDENTE'))
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists menu_items_delete_atendente on public.menu_items;
create policy menu_items_delete_atendente
  on public.menu_items
  for delete
  using (app.has_min_role(tenant_id, 'ATENDENTE'));

grant select, insert, update, delete on public.menu_items to authenticated;
