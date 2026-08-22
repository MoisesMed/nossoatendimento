create table if not exists public.restaurant_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_id text null,
  mesa_id uuid not null references public.restaurant_tables(id) on delete cascade,
  mesa_code integer null,
  mesa_name text not null,
  closed_at timestamptz not null default timezone('utc', now()),
  subtotal numeric(12, 2) not null default 0,
  couvert_total numeric(12, 2) not null default 0,
  service_charge_total numeric(12, 2) not null default 0,
  grand_total numeric(12, 2) not null default 0,
  paid_total numeric(12, 2) not null default 0,
  remaining_total numeric(12, 2) not null default 0,
  observation text null,
  items jsonb not null default '[]'::jsonb,
  payments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_restaurant_sales_tenant_source_id
  on public.restaurant_sales (tenant_id, source_id);

create index if not exists idx_restaurant_sales_tenant_closed_at
  on public.restaurant_sales (tenant_id, closed_at desc);

create index if not exists idx_restaurant_sales_tenant_mesa
  on public.restaurant_sales (tenant_id, mesa_id);

drop trigger if exists trg_restaurant_sales_updated_at on public.restaurant_sales;
create trigger trg_restaurant_sales_updated_at
before update on public.restaurant_sales
for each row
execute function public.touch_updated_at();

alter table public.restaurant_sales enable row level security;
alter table public.restaurant_sales force row level security;

drop policy if exists restaurant_sales_select_staff on public.restaurant_sales;
create policy restaurant_sales_select_staff
  on public.restaurant_sales
  for select
  using (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists restaurant_sales_insert_staff on public.restaurant_sales;
create policy restaurant_sales_insert_staff
  on public.restaurant_sales
  for insert
  with check (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists restaurant_sales_update_staff on public.restaurant_sales;
create policy restaurant_sales_update_staff
  on public.restaurant_sales
  for update
  using (app.has_min_role(tenant_id, 'USUARIO'))
  with check (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists restaurant_sales_delete_staff on public.restaurant_sales;
create policy restaurant_sales_delete_staff
  on public.restaurant_sales
  for delete
  using (app.has_min_role(tenant_id, 'USUARIO'));

grant select, insert, update, delete on public.restaurant_sales to authenticated;
