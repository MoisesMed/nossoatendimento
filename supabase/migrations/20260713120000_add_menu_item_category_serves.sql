alter table public.menu_items
  add column if not exists category text not null default 'Geral',
  add column if not exists serves_people integer not null default 1;

alter table public.menu_items
  add constraint menu_items_category_len_chk
  check (char_length(category) between 2 and 60);

alter table public.menu_items
  add constraint menu_items_serves_people_chk
  check (serves_people >= 1 and serves_people <= 99);

create index if not exists idx_menu_items_tenant_category
  on public.menu_items (tenant_id, category);
