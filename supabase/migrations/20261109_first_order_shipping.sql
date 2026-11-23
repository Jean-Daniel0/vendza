-- Livraison offerte sur la 1re commande : part de la livraison prise en charge par Vendza (en gourdes).
-- Le client paie total_price ; le vendeur est versé sur total_price + shipping_subsidy.
alter table public.pending_orders add column if not exists shipping_subsidy numeric not null default 0;
alter table public.orders add column if not exists shipping_subsidy numeric not null default 0;
