alter table public.menu_items
  add column if not exists pricing_type text not null default 'UNIDADE';

alter table public.menu_items
  drop constraint if exists menu_items_pricing_type_chk;

alter table public.menu_items
  add constraint menu_items_pricing_type_chk
  check (pricing_type in ('UNIDADE', 'PESO'));
