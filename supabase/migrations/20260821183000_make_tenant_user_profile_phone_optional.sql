alter table public.tenant_user_profiles
  alter column phone drop not null;

update public.tenant_user_profiles
set phone = null
where btrim(phone) = '';
