-- Colonnes prix sur les commandes (tickets, commandes vendeur, historique client)
-- A coller dans Supabase -> SQL Editor.

alter table public.orders add column if not exists unit_price numeric;
alter table public.orders add column if not exists price numeric;
alter table public.orders add column if not exists items jsonb;
alter table public.orders add column if not exists shipping_fee numeric default 0;
alter table public.orders add column if not exists vendor_credited boolean not null default false;
