create or replace function public.handle_new_user_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_slug text;
  resolved_tenant_id uuid;
begin
  resolved_slug := coalesce(new.raw_user_meta_data ->> 'tenant_slug', 'manja');

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
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_membership on auth.users;
create trigger trg_auth_user_membership
after insert on auth.users
for each row
execute function public.handle_new_user_membership();

insert into public.memberships (tenant_id, user_id, role, active)
select t.id, u.id, 'STAFF'::public.membership_role, true
from auth.users u
join public.tenants t
  on t.slug = coalesce(u.raw_user_meta_data ->> 'tenant_slug', 'manja')
left join public.memberships m
  on m.tenant_id = t.id
 and m.user_id = u.id
where m.id is null;
