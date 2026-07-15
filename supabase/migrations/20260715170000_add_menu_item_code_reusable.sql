alter table public.menu_items
  add column if not exists code integer;

alter table public.menu_items
  drop constraint if exists menu_items_code_positive_chk;

alter table public.menu_items
  add constraint menu_items_code_positive_chk
  check (code is null or code > 0);

with ranked as (
  select
    id,
    row_number() over (
      partition by tenant_id
      order by created_at asc, id asc
    ) as next_code
  from public.menu_items
  where active = true
)
update public.menu_items mi
set code = ranked.next_code
from ranked
where mi.id = ranked.id
  and mi.code is null;

create or replace function app.next_menu_item_code(p_tenant_id uuid)
returns integer
language sql
set search_path = public
as $$
  with used_codes as (
    select code
    from public.menu_items
    where tenant_id = p_tenant_id
      and active = true
      and code is not null
  ), max_code as (
    select coalesce(max(code), 0) as max_code
    from used_codes
  )
  select gs
  from generate_series(1, (select max_code + 1 from max_code)) as gs
  left join used_codes uc on uc.code = gs
  where uc.code is null
  order by gs
  limit 1;
$$;

create or replace function app.assign_menu_item_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.code is null then
    new.code := app.next_menu_item_code(new.tenant_id);
  end if;

  if new.code is null or new.code < 1 then
    raise exception 'Falha ao gerar codigo do item';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_menu_items_assign_code on public.menu_items;
create trigger trg_menu_items_assign_code
before insert on public.menu_items
for each row
execute function app.assign_menu_item_code();

drop index if exists uq_menu_items_tenant_code_active;
create unique index uq_menu_items_tenant_code_active
  on public.menu_items (tenant_id, code)
  where active = true and code is not null;
