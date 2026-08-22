alter table public.restaurant_sales
  add column if not exists sale_type text not null default 'MESA' check (sale_type in ('MESA', 'AVULSA'));

alter table public.restaurant_sales
  add column if not exists customer_name text null;

alter table public.restaurant_sales
  alter column mesa_id drop not null;

update public.restaurant_sales
set sale_type = 'MESA'
where sale_type is null or sale_type = '';

create index if not exists idx_restaurant_sales_tenant_sale_type
  on public.restaurant_sales (tenant_id, sale_type, closed_at desc);
