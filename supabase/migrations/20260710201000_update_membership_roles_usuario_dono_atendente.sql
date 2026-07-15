do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'membership_role'
      and e.enumlabel = 'OWNER'
  ) then
    execute 'alter type public.membership_role rename value ''OWNER'' to ''DONO''';
  end if;

  if exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'membership_role'
      and e.enumlabel = 'ADMIN'
  ) then
    execute 'alter type public.membership_role rename value ''ADMIN'' to ''ATENDENTE''';
  end if;

  if exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'membership_role'
      and e.enumlabel = 'STAFF'
  ) then
    execute 'alter type public.membership_role rename value ''STAFF'' to ''USUARIO''';
  end if;
end;
$$;

alter table public.memberships
  alter column role set default 'USUARIO';

create or replace function app.role_rank(role_value public.membership_role)
returns integer
language sql
immutable
as $$
  select case role_value
    when 'DONO' then 3
    when 'ATENDENTE' then 2
    when 'USUARIO' then 1
  end;
$$;

create or replace function public.handle_new_user_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_slug text;
  resolved_tenant_id uuid;
  resolved_email text;
  resolved_phone text;
  resolved_full_name text;
begin
  resolved_slug := coalesce(new.raw_user_meta_data ->> 'tenant_slug', 'manja');
  resolved_email := lower(trim(new.email));
  resolved_phone := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g');
  resolved_full_name := coalesce(trim(new.raw_user_meta_data ->> 'full_name'), '');

  select t.id
    into resolved_tenant_id
  from public.tenants t
  where t.slug = resolved_slug
  limit 1;

  if resolved_tenant_id is null then
    select t.id
      into resolved_tenant_id
    from public.tenants t
    where t.slug = 'manja'
    limit 1;
  end if;

  if resolved_tenant_id is not null then
    insert into public.memberships (tenant_id, user_id, role, active)
    values (resolved_tenant_id, new.id, 'USUARIO', true)
    on conflict (tenant_id, user_id) do update
      set active = true;

    insert into public.tenant_user_profiles (tenant_id, user_id, email, phone, full_name)
    values (resolved_tenant_id, new.id, resolved_email, resolved_phone, resolved_full_name)
    on conflict (tenant_id, user_id) do update
      set email = excluded.email,
          phone = excluded.phone,
          full_name = excluded.full_name,
          updated_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

create or replace function public.ensure_default_membership()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  resolved_slug text;
  resolved_tenant_id uuid;
  resolved_email text;
  resolved_phone text;
  resolved_full_name text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return false;
  end if;

  select
    coalesce(u.raw_user_meta_data ->> 'tenant_slug', 'manja'),
    lower(trim(u.email)),
    regexp_replace(coalesce(u.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g'),
    coalesce(trim(u.raw_user_meta_data ->> 'full_name'), '')
  into
    resolved_slug,
    resolved_email,
    resolved_phone,
    resolved_full_name
  from auth.users u
  where u.id = current_user_id;

  select t.id
    into resolved_tenant_id
  from public.tenants t
  where t.slug = resolved_slug
  limit 1;

  if resolved_tenant_id is null then
    select t.id
      into resolved_tenant_id
    from public.tenants t
    where t.slug = 'manja'
    limit 1;
  end if;

  if resolved_tenant_id is null then
    return false;
  end if;

  insert into public.memberships (tenant_id, user_id, role, active)
  values (resolved_tenant_id, current_user_id, 'USUARIO', true)
  on conflict (tenant_id, user_id)
  do update set active = true;

  begin
    insert into public.tenant_user_profiles (tenant_id, user_id, email, phone, full_name)
    values (resolved_tenant_id, current_user_id, resolved_email, resolved_phone, resolved_full_name)
    on conflict (tenant_id, user_id)
    do update set
      email = excluded.email,
      phone = excluded.phone,
      full_name = excluded.full_name,
      updated_at = timezone('utc', now());
  exception
    when unique_violation then
      return false;
  end;

  return true;
end;
$$;

alter table public.tenants enable row level security;
alter table public.tenants force row level security;

alter table public.memberships enable row level security;
alter table public.memberships force row level security;

alter table public.reservations enable row level security;
alter table public.reservations force row level security;

drop policy if exists tenants_select_member on public.tenants;
create policy tenants_select_member
  on public.tenants
  for select
  using (app.has_membership(id));

drop policy if exists tenants_update_admin on public.tenants;
create policy tenants_update_admin
  on public.tenants
  for update
  using (app.has_min_role(id, 'ATENDENTE'))
  with check (app.has_min_role(id, 'ATENDENTE'));

drop policy if exists memberships_select_self_or_admin on public.memberships;
create policy memberships_select_self_or_admin
  on public.memberships
  for select
  using (user_id = auth.uid() or app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists memberships_insert_admin on public.memberships;
create policy memberships_insert_admin
  on public.memberships
  for insert
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists memberships_update_admin on public.memberships;
create policy memberships_update_admin
  on public.memberships
  for update
  using (app.has_min_role(tenant_id, 'ATENDENTE'))
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists memberships_delete_owner on public.memberships;
create policy memberships_delete_owner
  on public.memberships
  for delete
  using (app.has_min_role(tenant_id, 'DONO'));

drop policy if exists reservations_select_staff on public.reservations;
create policy reservations_select_staff
  on public.reservations
  for select
  using (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists reservations_insert_staff on public.reservations;
create policy reservations_insert_staff
  on public.reservations
  for insert
  with check (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists reservations_update_staff on public.reservations;
create policy reservations_update_staff
  on public.reservations
  for update
  using (app.has_min_role(tenant_id, 'USUARIO'))
  with check (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists restaurant_tables_select_staff on public.restaurant_tables;
create policy restaurant_tables_select_staff
  on public.restaurant_tables
  for select
  using (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists restaurant_tables_insert_staff on public.restaurant_tables;
create policy restaurant_tables_insert_staff
  on public.restaurant_tables
  for insert
  with check (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists restaurant_tables_update_staff on public.restaurant_tables;
create policy restaurant_tables_update_staff
  on public.restaurant_tables
  for update
  using (app.has_min_role(tenant_id, 'USUARIO'))
  with check (app.has_min_role(tenant_id, 'USUARIO'));

drop policy if exists restaurant_tables_delete_admin on public.restaurant_tables;
create policy restaurant_tables_delete_admin
  on public.restaurant_tables
  for delete
  using (app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists tenant_user_profiles_select_self_or_admin on public.tenant_user_profiles;
create policy tenant_user_profiles_select_self_or_admin
  on public.tenant_user_profiles
  for select
  using (user_id = auth.uid() or app.has_min_role(tenant_id, 'ATENDENTE'));

drop policy if exists tenant_user_profiles_update_admin on public.tenant_user_profiles;
create policy tenant_user_profiles_update_admin
  on public.tenant_user_profiles
  for update
  using (app.has_min_role(tenant_id, 'ATENDENTE'))
  with check (app.has_min_role(tenant_id, 'ATENDENTE'));
