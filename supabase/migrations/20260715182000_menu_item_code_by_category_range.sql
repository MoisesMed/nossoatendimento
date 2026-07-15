create or replace function app.menu_category_slot(p_tenant_id uuid, p_category text)
returns integer
language sql
stable
set search_path = public
as $$
  with category_catalog as (
    select
      btrim(mc.name) as category_name,
      coalesce(mc.sort_order, 9999) as sort_key
    from public.menu_categories mc
    where mc.tenant_id = p_tenant_id
      and mc.active = true

    union

    select
      btrim(mi.category) as category_name,
      9999 as sort_key
    from public.menu_items mi
    where mi.tenant_id = p_tenant_id
      and mi.active = true
      and mi.category is not null
      and btrim(mi.category) <> ''

    union

    select 'Sem Categoria' as category_name, 9999 as sort_key
  ), normalized as (
    select
      category_name,
      min(sort_key) as sort_key
    from category_catalog
    where category_name is not null
      and category_name <> ''
    group by category_name
  ), ranked as (
    select
      category_name,
      row_number() over (order by sort_key asc, category_name asc) as slot
    from normalized
  )
  select coalesce(
    (
      select r.slot
      from ranked r
      where r.category_name = coalesce(nullif(btrim(p_category), ''), 'Sem Categoria')
      limit 1
    ),
    1
  );
$$;

create or replace function app.next_menu_item_code(p_tenant_id uuid, p_category text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_slot integer;
  v_base integer;
  v_next integer;
begin
  v_slot := app.menu_category_slot(p_tenant_id, p_category);
  v_base := v_slot * 1000;

  select gs
  into v_next
  from generate_series(v_base + 1, v_base + 999) as gs
  left join public.menu_items mi
    on mi.tenant_id = p_tenant_id
   and mi.active = true
   and mi.code = gs
  where mi.id is null
  order by gs
  limit 1;

  if v_next is null then
    raise exception 'Categoria lotada para geracao de codigo (tenant %, categoria %)', p_tenant_id, p_category;
  end if;

  return v_next;
end;
$$;

create or replace function app.assign_menu_item_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active = true and (
    tg_op = 'INSERT'
    or new.code is null
    or new.category is distinct from old.category
    or new.tenant_id is distinct from old.tenant_id
    or old.active = false
  ) then
    new.code := app.next_menu_item_code(new.tenant_id, new.category);
  end if;

  if new.active = true and (new.code is null or new.code < 1) then
    raise exception 'Falha ao gerar codigo do item';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_menu_items_assign_code on public.menu_items;
create trigger trg_menu_items_assign_code
before insert or update of tenant_id, category, active, code on public.menu_items
for each row
execute function app.assign_menu_item_code();

do $$
begin
  if exists (
    with ranked as (
      select
        mi.id,
        row_number() over (
          partition by mi.tenant_id, coalesce(nullif(btrim(mi.category), ''), 'Sem Categoria')
          order by mi.created_at asc, mi.id asc
        ) as category_position
      from public.menu_items mi
      where mi.active = true
    )
    select 1
    from ranked
    where category_position > 999
  ) then
    raise exception 'Uma ou mais categorias excedem o limite de 999 itens ativos para o padrao 1xxx/2xxx';
  end if;
end;
$$;

with ranked as (
  select
    mi.id,
    app.menu_category_slot(mi.tenant_id, mi.category) as category_slot,
    row_number() over (
      partition by mi.tenant_id, coalesce(nullif(btrim(mi.category), ''), 'Sem Categoria')
      order by mi.created_at asc, mi.id asc
    ) as category_position
  from public.menu_items mi
  where mi.active = true
)
update public.menu_items mi
set code = (ranked.category_slot * 1000) + ranked.category_position
from ranked
where mi.id = ranked.id;
