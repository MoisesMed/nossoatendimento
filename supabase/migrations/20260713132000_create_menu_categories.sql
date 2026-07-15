create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, name)
);

create index if not exists idx_menu_categories_tenant_active
  on public.menu_categories (tenant_id, active);

create index if not exists idx_menu_categories_tenant_name
  on public.menu_categories (tenant_id, name);

drop trigger if exists trg_menu_categories_updated_at on public.menu_categories;
create trigger trg_menu_categories_updated_at
before update on public.menu_categories
for each row
execute function public.touch_updated_at();

alter table public.menu_categories enable row level security;
alter table public.menu_categories force row level security;

drop policy if exists menu_categories_select_usuario on public.menu_categories;
create policy menu_categories_select_usuario
  on public.menu_categories
  for select
  using (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists menu_categories_insert_atendente on public.menu_categories;
create policy menu_categories_insert_atendente
  on public.menu_categories
  for insert
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists menu_categories_update_atendente on public.menu_categories;
create policy menu_categories_update_atendente
  on public.menu_categories
  for update
  using (app.has_min_role(tenant_id, 'ATENDENTE'))
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists menu_categories_delete_atendente on public.menu_categories;
create policy menu_categories_delete_atendente
  on public.menu_categories
  for delete
  using (app.has_min_role(tenant_id, 'ATENDENTE'));

grant select, insert, update, delete on public.menu_categories to authenticated;
