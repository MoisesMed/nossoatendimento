create type public.table_status as enum (
  'VAZIA',
  'OCUPADA',
  'EM_PREPARO',
  'AGUARDANDO_PAGAMENTO'
);

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code integer not null check (code > 0),
  name text not null,
  seats integer not null default 4 check (seats > 0 and seats <= 30),
  status public.table_status not null default 'VAZIA',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, code),
  unique (tenant_id, name)
);

create index if not exists idx_restaurant_tables_tenant_status
  on public.restaurant_tables (tenant_id, status);

create index if not exists idx_restaurant_tables_tenant_active
  on public.restaurant_tables (tenant_id, active);

drop trigger if exists trg_restaurant_tables_updated_at on public.restaurant_tables;
create trigger trg_restaurant_tables_updated_at
before update on public.restaurant_tables
for each row
execute function public.touch_updated_at();

alter table public.restaurant_tables enable row level security;
alter table public.restaurant_tables force row level security;

drop policy if exists restaurant_tables_select_staff on public.restaurant_tables;
create policy restaurant_tables_select_staff
  on public.restaurant_tables
  for select
  using (app.has_min_role(tenant_id, 'STAFF'));

drop policy if exists restaurant_tables_insert_staff on public.restaurant_tables;
create policy restaurant_tables_insert_staff
  on public.restaurant_tables
  for insert
  with check (app.has_min_role(tenant_id, 'STAFF'));

drop policy if exists restaurant_tables_update_staff on public.restaurant_tables;
create policy restaurant_tables_update_staff
  on public.restaurant_tables
  for update
  using (app.has_min_role(tenant_id, 'STAFF'))
  with check (app.has_min_role(tenant_id, 'STAFF'));

drop policy if exists restaurant_tables_delete_admin on public.restaurant_tables;
create policy restaurant_tables_delete_admin
  on public.restaurant_tables
  for delete
  using (app.has_min_role(tenant_id, 'ADMIN'));

grant select, insert, update, delete on public.restaurant_tables to authenticated;
