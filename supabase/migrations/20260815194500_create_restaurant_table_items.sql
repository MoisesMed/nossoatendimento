create table if not exists public.restaurant_table_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  name text not null,
  quantity integer not null check (quantity > 0),
  price numeric(12, 2) not null check (price >= 0),
  original_price numeric(12, 2),
  delivered boolean not null default false,
  pricing_type text check (pricing_type in ('UNIDADE', 'PESO')),
  weight_kg numeric(10, 3),
  additional_titles text[] not null default '{}'::text[],
  additional_total numeric(12, 2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_restaurant_table_items_tenant_table
  on public.restaurant_table_items (tenant_id, table_id);

create index if not exists idx_restaurant_table_items_tenant_delivered
  on public.restaurant_table_items (tenant_id, delivered);

drop trigger if exists trg_restaurant_table_items_updated_at on public.restaurant_table_items;
create trigger trg_restaurant_table_items_updated_at
before update on public.restaurant_table_items
for each row
execute function public.touch_updated_at();

alter table public.restaurant_table_items enable row level security;
alter table public.restaurant_table_items force row level security;

drop policy if exists restaurant_table_items_select_staff on public.restaurant_table_items;
create policy restaurant_table_items_select_staff
  on public.restaurant_table_items
  for select
  using (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists restaurant_table_items_insert_staff on public.restaurant_table_items;
create policy restaurant_table_items_insert_staff
  on public.restaurant_table_items
  for insert
  with check (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists restaurant_table_items_update_staff on public.restaurant_table_items;
create policy restaurant_table_items_update_staff
  on public.restaurant_table_items
  for update
  using (app.has_min_role(tenant_id, 'USUARIO'))
  with check (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists restaurant_table_items_delete_staff on public.restaurant_table_items;
create policy restaurant_table_items_delete_staff
  on public.restaurant_table_items
  for delete
  using (app.has_min_role(tenant_id, 'USUARIO'));

grant select, insert, update, delete on public.restaurant_table_items to authenticated;
