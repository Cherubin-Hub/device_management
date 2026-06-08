# Client Code Supabase SQL Patch

Run this in the Supabase SQL Editor before using the updated client code fields.

```sql
alter table public.clients
add column if not exists client_code text;

update public.clients
set client_code = 'CLIENT-' || id
where client_code is null or btrim(client_code) = '';

alter table public.clients
alter column client_code set not null;

alter table public.clients
drop constraint if exists clients_name_key;

drop index if exists clients_client_code_unique;

create unique index clients_client_code_unique
on public.clients (lower(client_code));

alter table public.device_inventory_items
add column if not exists client_id bigint references public.clients(id) on delete set null;

create index if not exists device_inventory_items_client_id_idx
on public.device_inventory_items(client_id);

alter table public.ongoing_testing_items
add column if not exists client_id bigint references public.clients(id) on delete set null;

create index if not exists ongoing_testing_items_client_id_idx
on public.ongoing_testing_items(client_id);
```
