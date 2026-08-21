create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_audit_logs_tenant_created_at
  on public.audit_logs (tenant_id, created_at desc);

create index if not exists idx_audit_logs_table_operation
  on public.audit_logs (tenant_id, table_name, operation, created_at desc);

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

drop policy if exists audit_logs_select_atendente on public.audit_logs;
create policy audit_logs_select_atendente
  on public.audit_logs
  for select
  using (app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists audit_logs_insert_system on public.audit_logs;
create policy audit_logs_insert_system
  on public.audit_logs
  for insert
  with check (true);

grant select, insert on public.audit_logs to authenticated;

create or replace function app.capture_tenant_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  actor_id uuid;
  previous_row jsonb;
  next_row jsonb;
  target_record_id text;
begin
  if tg_op = 'DELETE' then
    target_tenant_id := old.tenant_id;
    previous_row := to_jsonb(old);
    next_row := null;
    target_record_id := coalesce((to_jsonb(old) ->> 'id'), null);
  elsif tg_op = 'UPDATE' then
    target_tenant_id := new.tenant_id;
    previous_row := to_jsonb(old);
    next_row := to_jsonb(new);
    target_record_id := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'));
  else
    target_tenant_id := new.tenant_id;
    previous_row := null;
    next_row := to_jsonb(new);
    target_record_id := coalesce((to_jsonb(new) ->> 'id'), null);
  end if;

  actor_id := auth.uid();

  insert into public.audit_logs (
    tenant_id,
    actor_user_id,
    table_name,
    operation,
    record_id,
    old_data,
    new_data
  )
  values (
    target_tenant_id,
    actor_id,
    tg_table_name,
    tg_op,
    target_record_id,
    previous_row,
    next_row
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function app.sync_audit_triggers()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row_record record;
  trigger_name text;
begin
  for row_record in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'tenant_id'
      and a.attnum > 0
      and not a.attisdropped
      and c.relname <> 'audit_logs'
  loop
    trigger_name := 'trg_audit_' || row_record.table_name;

    execute format('drop trigger if exists %I on public.%I', trigger_name, row_record.table_name);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function app.capture_tenant_audit_log()',
      trigger_name,
      row_record.table_name
    );
  end loop;
end;
$$;

select app.sync_audit_triggers();