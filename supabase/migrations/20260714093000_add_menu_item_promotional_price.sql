alter table public.menu_items
  add column if not exists promotional_price numeric(10,2);

alter table public.menu_items
  add constraint menu_items_promotional_price_chk
  check (
    promotional_price is null
    or promotional_price >= 0
  );
