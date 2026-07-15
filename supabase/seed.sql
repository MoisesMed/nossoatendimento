insert into public.tenants (slug, name, theme)
values
  (
    'manja',
    'MANJA',
    '{"primary":"#0f766e","accent":"#0ea5e9","mode":"light"}'::jsonb
  ),
  (
    'moises',
    'MOISES',
    '{"primary":"#065f46","accent":"#f97316","mode":"light"}'::jsonb
  )
on conflict (slug) do update
set
  name = excluded.name,
  theme = excluded.theme;

insert into public.reservations (tenant_id, customer_name, customer_phone, table_code, party_size, status)
select t.id, 'Cliente Teste ' || upper(t.slug), '11999990000', 'A1', 2, 'ACTIVE'
from public.tenants t
where t.slug in ('manja', 'moises')
on conflict do nothing;
