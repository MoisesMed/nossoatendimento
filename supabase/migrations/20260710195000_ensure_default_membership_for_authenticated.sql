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
  values (resolved_tenant_id, current_user_id, 'STAFF', true)
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

grant execute on function public.ensure_default_membership() to authenticated;
