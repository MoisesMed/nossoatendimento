alter table public.restaurant_table_items
  add column if not exists code integer;

alter table public.restaurant_table_items
  drop constraint if exists restaurant_table_items_code_positive_chk;

alter table public.restaurant_table_items
  add constraint restaurant_table_items_code_positive_chk
  check (code is null or code > 0);

create index if not exists idx_restaurant_table_items_tenant_code
  on public.restaurant_table_items (tenant_id, code)
  where code is not null;
