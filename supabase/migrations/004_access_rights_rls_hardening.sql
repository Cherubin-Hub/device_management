-- Optional RLS hardening.
-- Apply after app_users rows are created and access_rights are configured.

create or replace function public.has_app_access(access_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        user_profile.is_active
        and coalesce((user_profile.access_rights ->> access_key)::boolean, true)
      from public.app_users as user_profile
      where user_profile.id = auth.uid()
    ),
    false
  );
$$;

drop policy if exists "authenticated users can manage device inventory" on public.device_inventory_items;
create policy "users with repair records access can insert device inventory"
on public.device_inventory_items for insert to authenticated
with check (public.has_app_access('deviceInventoryRecords'));

create policy "users with repair records access can update device inventory"
on public.device_inventory_items for update to authenticated
using (public.has_app_access('deviceInventoryRecords'))
with check (public.has_app_access('deviceInventoryRecords'));

create policy "users with repair records access can delete device inventory"
on public.device_inventory_items for delete to authenticated
using (public.has_app_access('deviceInventoryRecords'));

drop policy if exists "authenticated users can manage archived records" on public.archived_records;
create policy "users with archive access can manage archived records"
on public.archived_records for all to authenticated
using (public.has_app_access('archivedRecords') or public.has_app_access('deviceInventoryRecords'))
with check (public.has_app_access('archivedRecords') or public.has_app_access('deviceInventoryRecords'));

drop policy if exists "authenticated users can manage email configurations" on public.email_configurations;
create policy "users with email configuration access can manage email configurations"
on public.email_configurations for all to authenticated
using (public.has_app_access('emailConfiguration'))
with check (public.has_app_access('emailConfiguration'));

drop policy if exists "authenticated users can read audit trail" on public.audit_trail;
create policy "users with audit access can read audit trail"
on public.audit_trail for select to authenticated
using (public.has_app_access('auditTrail') or public.has_app_access('reportsAdministration'));

drop policy if exists "authenticated users can update app users" on public.app_users;
create policy "users with user admin access can update app users"
on public.app_users for update to authenticated
using (public.has_app_access('users'))
with check (public.has_app_access('users'));

drop policy if exists "authenticated users can read app users" on public.app_users;
create policy "users can read own profile or user admins can read all profiles"
on public.app_users for select to authenticated
using (id = auth.uid() or public.has_app_access('users'));
