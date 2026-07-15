create schema if not exists app;

create type public.membership_role as enum ('OWNER', 'ADMIN', 'STAFF');
create type public.reservation_status as enum ('ACTIVE', 'CHECKED_IN', 'FINISHED', 'CANCELLED');

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'STAFF',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, user_id)
);

create index if not exists idx_memberships_tenant_user on public.memberships (tenant_id, user_id);
create index if not exists idx_memberships_user on public.memberships (user_id);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  table_code text not null,
  party_size integer not null check (party_size > 0),
  status public.reservation_status not null default 'ACTIVE',
  checked_in_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_reservations_tenant_status on public.reservations (tenant_id, status);
create index if not exists idx_reservations_tenant_created_at on public.reservations (tenant_id, created_at desc);

create or replace function app.role_rank(role_value public.membership_role)
returns integer
language sql
immutable
as $$
  select case role_value
    when 'OWNER' then 3
    when 'ADMIN' then 2
    when 'STAFF' then 1
  end;
$$;

create or replace function app.has_membership(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.tenant_id = target_tenant_id
      and m.user_id = auth.uid()
      and m.active = true
  );
$$;

create or replace function app.has_min_role(target_tenant_id uuid, minimum_role public.membership_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.tenant_id = target_tenant_id
      and m.user_id = auth.uid()
      and m.active = true
      and app.role_rank(m.role) >= app.role_rank(minimum_role)
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
before update on public.reservations
for each row
execute function public.touch_updated_at();

create or replace function public.check_in_reservation(reservation_id uuid)
returns public.reservations
language plpgsql
security invoker
as $$
declare
  updated_row public.reservations;
begin
  update public.reservations r
  set status = 'CHECKED_IN',
      checked_in_at = timezone('utc', now())
  where r.id = reservation_id
    and r.status = 'ACTIVE'
  returning r.* into updated_row;

  if updated_row.id is null then
    raise exception 'Reservation not found or invalid status';
  end if;

  return updated_row;
end;
$$;

create or replace function public.finish_reservation(reservation_id uuid)
returns public.reservations
language plpgsql
security invoker
as $$
declare
  updated_row public.reservations;
begin
  update public.reservations r
  set status = 'FINISHED',
      finished_at = timezone('utc', now())
  where r.id = reservation_id
    and r.status = 'CHECKED_IN'
  returning r.* into updated_row;

  if updated_row.id is null then
    raise exception 'Reservation not found or invalid status';
  end if;

  return updated_row;
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
  using (app.has_min_role(id, 'ADMIN'))
  with check (app.has_min_role(id, 'ADMIN'));

drop policy if exists memberships_select_self_or_admin on public.memberships;
create policy memberships_select_self_or_admin
  on public.memberships
  for select
  using (user_id = auth.uid() or app.has_min_role(tenant_id, 'ADMIN'));

drop policy if exists memberships_insert_admin on public.memberships;
create policy memberships_insert_admin
  on public.memberships
  for insert
  with check (app.has_min_role(tenant_id, 'ADMIN'));

drop policy if exists memberships_update_admin on public.memberships;
create policy memberships_update_admin
  on public.memberships
  for update
  using (app.has_min_role(tenant_id, 'ADMIN'))
  with check (app.has_min_role(tenant_id, 'ADMIN'));

drop policy if exists memberships_delete_owner on public.memberships;
create policy memberships_delete_owner
  on public.memberships
  for delete
  using (app.has_min_role(tenant_id, 'OWNER'));

drop policy if exists reservations_select_staff on public.reservations;
create policy reservations_select_staff
  on public.reservations
  for select
  using (app.has_min_role(tenant_id, 'STAFF'));

drop policy if exists reservations_insert_staff on public.reservations;
create policy reservations_insert_staff
  on public.reservations
  for insert
  with check (app.has_min_role(tenant_id, 'STAFF'));

drop policy if exists reservations_update_staff on public.reservations;
create policy reservations_update_staff
  on public.reservations
  for update
  using (app.has_min_role(tenant_id, 'STAFF'))
  with check (app.has_min_role(tenant_id, 'STAFF'));

grant select, update on public.tenants to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select, insert, update on public.reservations to authenticated;
grant execute on function public.check_in_reservation(uuid) to authenticated;
grant execute on function public.finish_reservation(uuid) to authenticated;
