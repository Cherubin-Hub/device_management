-- Email templates used by Repair Records register/unregister actions.

create table if not exists public.email_configurations (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  to_email text not null default '',
  cc_email text not null default '',
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

comment on table public.email_configurations is 'Stores configurable email templates for Repair Records register and unregister device actions.';

alter table public.email_configurations enable row level security;

drop policy if exists "authenticated users can read email configurations" on public.email_configurations;
create policy "authenticated users can read email configurations"
on public.email_configurations for select to authenticated using (true);

drop policy if exists "authenticated users can manage email configurations" on public.email_configurations;
create policy "authenticated users can manage email configurations"
on public.email_configurations for all to authenticated using (true) with check (true);

insert into public.email_configurations (template_key, name, subject, body)
values
  (
    'registerDevice',
    'Register Device',
    'Register Device - #SN',
    'Hi,' || chr(10) || chr(10) ||
    'Please register device #SN.' || chr(10) || chr(10) ||
    'Device Type: #DEVICE_TYPE' || chr(10) ||
    'CST Number: #CST' || chr(10) ||
    'Ticket Number: #TICKET' || chr(10) || chr(10) ||
    'Thank you.'
  ),
  (
    'unregisterDevice',
    'Unregister Device',
    'Unregister Device - #SN',
    'Hi,' || chr(10) || chr(10) ||
    'Please unregister device #SN.' || chr(10) || chr(10) ||
    'Device Type: #DEVICE_TYPE' || chr(10) ||
    'CST Number: #CST' || chr(10) ||
    'Ticket Number: #TICKET' || chr(10) || chr(10) ||
    'Thank you.'
  )
on conflict (template_key) do nothing;
