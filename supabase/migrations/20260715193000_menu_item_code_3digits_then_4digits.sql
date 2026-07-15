create or replace function app.next_menu_item_code(p_tenant_id uuid, p_category text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_slot integer;
  v_three_start integer;
  v_three_end integer;
  v_four_start integer;
  v_four_end integer;
  v_next integer;
begin
  v_slot := app.menu_category_slot(p_tenant_id, p_category);

  -- Primary range: 3-digit codes per category (1xx, 2xx, ...).
  v_three_start := v_slot * 100;
  v_three_end := v_three_start + 99;

  select gs
  into v_next
  from generate_series(v_three_start, v_three_end) as gs
  left join public.menu_items mi
    on mi.tenant_id = p_tenant_id
   and mi.active = true
   and mi.code = gs
  where mi.id is null
  order by gs
  limit 1;

  if v_next is not null then
    return v_next;
  end if;

  -- Overflow range: 4-digit codes for the same category (1000+, 2000+, ...).
  v_four_start := v_slot * 1000;
  v_four_end := v_four_start + 999;

  select gs
  into v_next
  from generate_series(v_four_start, v_four_end) as gs
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
    where category_position > 1100
  ) then
    raise exception 'Uma ou mais categorias excedem o limite de 1100 itens ativos para o padrao 3 digitos + overflow 4 digitos';
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
    ) as category_position,
    row_number() over (
      order by mi.tenant_id asc, mi.id asc
    ) as global_position
  from public.menu_items mi
  where mi.active = true
), staged as (
  select
    ranked.id,
    900000000 + ranked.global_position as temp_code,
    case
      when ranked.category_position <= 100
        then (ranked.category_slot * 100) + (ranked.category_position - 1)
      else (ranked.category_slot * 1000) + (ranked.category_position - 101)
    end as final_code
  from ranked
)
update public.menu_items mi
set code = staged.temp_code
from staged
where mi.id = staged.id;

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
), final_codes as (
  select
    ranked.id,
    case
      when ranked.category_position <= 100
        then (ranked.category_slot * 100) + (ranked.category_position - 1)
      else (ranked.category_slot * 1000) + (ranked.category_position - 101)
    end as final_code
  from ranked
)
update public.menu_items mi
set code = final_codes.final_code
from final_codes
where mi.id = final_codes.id;
