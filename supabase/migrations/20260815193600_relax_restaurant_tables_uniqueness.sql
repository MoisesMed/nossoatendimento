alter table public.restaurant_tables
  drop constraint if exists restaurant_tables_tenant_id_name_key;

alter table public.restaurant_tables
  drop constraint if exists restaurant_tables_tenant_id_code_key;

create index if not exists idx_restaurant_tables_tenant_code
  on public.restaurant_tables (tenant_id, code);

create index if not exists idx_restaurant_tables_tenant_name
  on public.restaurant_tables (tenant_id, name);
