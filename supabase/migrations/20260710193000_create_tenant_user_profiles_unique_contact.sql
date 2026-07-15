create table if not exists public.tenant_user_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  phone text not null,
  full_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, user_id),
  unique (tenant_id, email),
  unique (tenant_id, phone)
);

create index if not exists idx_tenant_user_profiles_tenant_user
  on public.tenant_user_profiles (tenant_id, user_id);

create index if not exists idx_tenant_user_profiles_tenant_email
  on public.tenant_user_profiles (tenant_id, email);

create index if not exists idx_tenant_user_profiles_tenant_phone
  on public.tenant_user_profiles (tenant_id, phone);

alter table public.tenant_user_profiles enable row level security;
alter table public.tenant_user_profiles force row level security;

drop policy if exists tenant_user_profiles_select_self_or_admin on public.tenant_user_profiles;
create policy tenant_user_profiles_select_self_or_admin
  on public.tenant_user_profiles
  for select
  using (user_id = auth.uid() or app.has_min_role(tenant_id, 'ADMIN'));

drop policy if exists tenant_user_profiles_update_admin on public.tenant_user_profiles;
create policy tenant_user_profiles_update_admin
  on public.tenant_user_profiles
  for update
  using (app.has_min_role(tenant_id, 'ADMIN'))
  with check (app.has_min_role(tenant_id, 'ADMIN'));

grant select, update on public.tenant_user_profiles to authenticated;

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
    values (resolved_tenant_id, new.id, 'STAFF', true)
    on conflict (tenant_id, user_id) do nothing;

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

drop trigger if exists trg_tenant_user_profiles_updated_at on public.tenant_user_profiles;
create trigger trg_tenant_user_profiles_updated_at
before update on public.tenant_user_profiles
for each row
execute function public.touch_updated_at();

insert into public.tenant_user_profiles (tenant_id, user_id, email, phone, full_name)
select
  m.tenant_id,
  u.id,
  lower(trim(u.email)) as email,
  regexp_replace(coalesce(u.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g') as phone,
  coalesce(trim(u.raw_user_meta_data ->> 'full_name'), '') as full_name
from auth.users u
join public.memberships m
  on m.user_id = u.id
 and m.active = true
left join public.tenant_user_profiles p
  on p.tenant_id = m.tenant_id
 and p.user_id = u.id
where p.id is null;
