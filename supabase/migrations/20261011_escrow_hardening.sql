-- Séquestre (eskrow) renforcé — appliquée en production APRÈS le déploiement du code correspondant (PR #6).

-- 1) Registre des paiements vérifiés par le serveur (écrit uniquement par le serveur : aucune policy client)
create table if not exists public.verified_payments (
  reference text primary key,
  payment_method text,
  transaction_id text,
  amount numeric,
  created_at timestamptz not null default now()
);
alter table public.verified_payments enable row level security;
drop policy if exists verified_payments_admin_select on public.verified_payments;
create policy verified_payments_admin_select on public.verified_payments for select to authenticated using (public.is_admin());

-- 2) Code de livraison secret (le vendeur l'affiche en QR via le serveur ; illisible depuis le navigateur)
create table if not exists public.order_delivery_codes (
  order_id uuid primary key references public.orders(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);
alter table public.order_delivery_codes enable row level security;

-- 3) Décrément atomique du stock (appelé uniquement par le serveur)
create or replace function public.decrement_product_stock(p_product_id uuid, p_qty int)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.products
     set stock = greatest(0, coalesce(stock, 0) - greatest(1, coalesce(p_qty, 1))), updated_at = now()
   where id = p_product_id;
$$;
revoke execute on function public.decrement_product_stock(uuid, int) from public, anon, authenticated;
grant execute on function public.decrement_product_stock(uuid, int) to service_role;

-- 4) Seul le serveur (service_role / admin) peut écrire les indicateurs de livraison et de versement
create or replace function public.orders_guard_sensitive() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;  -- serveur (service_role) ou admin
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('completed', 'livree')
       or coalesce(new.vendor_credited, false) or coalesce(new.reception_confirmed, false)
       or coalesce(new.is_validated, false) or coalesce(new.buyer_confirmed, false) or coalesce(new.client_confirmed, false) then
      raise exception 'Insertion refusée : les indicateurs de livraison et de versement sont réservés au serveur' using errcode = '42501';
    end if;
    return new;
  end if;

  if (new.status is distinct from old.status and new.status in ('completed', 'livree'))
     or new.reception_confirmed is distinct from old.reception_confirmed
     or new.buyer_confirmed is distinct from old.buyer_confirmed
     or new.buyer_confirmed_at is distinct from old.buyer_confirmed_at
     or new.client_confirmed is distinct from old.client_confirmed
     or new.client_confirmed_at is distinct from old.client_confirmed_at
     or new.is_validated is distinct from old.is_validated
     or new.vendor_credited is distinct from old.vendor_credited
     or new.vendor_credited_at is distinct from old.vendor_credited_at
     or new.total_price is distinct from old.total_price
     or new.vendor_id is distinct from old.vendor_id
     or new.payment_reference is distinct from old.payment_reference then
    raise exception 'Modification refusée : ces champs sont réservés au serveur' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.orders_guard_sensitive() from public, anon, authenticated;
drop trigger if exists trg_orders_guard_sensitive on public.orders;
create trigger trg_orders_guard_sensitive before insert or update on public.orders for each row execute function public.orders_guard_sensitive();

-- 5) Portefeuilles : plus d'écriture depuis le navigateur ; chaque vendeur ne lit que le sien
drop policy if exists vendor_wallets_authenticated_all_temp on public.vendor_wallets;
drop policy if exists vendor_wallet_tx_authenticated_all_temp on public.vendor_wallet_transactions;
drop policy if exists vendor_wallets_select_own on public.vendor_wallets;
create policy vendor_wallets_select_own on public.vendor_wallets for select to authenticated using (vendor_id = (select auth.uid()));
drop policy if exists vendor_wallets_admin_all on public.vendor_wallets;
create policy vendor_wallets_admin_all on public.vendor_wallets for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists vendor_wallet_tx_select_own on public.vendor_wallet_transactions;
create policy vendor_wallet_tx_select_own on public.vendor_wallet_transactions for select to authenticated using (vendor_id = (select auth.uid()));
drop policy if exists vendor_wallet_tx_admin_all on public.vendor_wallet_transactions;
create policy vendor_wallet_tx_admin_all on public.vendor_wallet_transactions for all to authenticated using (public.is_admin()) with check (public.is_admin());
