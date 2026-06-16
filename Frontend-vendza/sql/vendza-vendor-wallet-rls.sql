-- Portefeuille vendeur + credit a la confirmation de livraison par le client
-- A coller dans Supabase -> SQL Editor (apres vendza-order-prices-columns.sql).

alter table public.orders add column if not exists vendor_credited boolean not null default false;
alter table public.orders add column if not exists vendor_credited_at timestamptz;

create table if not exists public.vendor_wallets (
  vendor_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric not null,
  type text not null default 'credit',
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists vendor_wallet_tx_order_unique
  on public.vendor_wallet_transactions (order_id)
  where order_id is not null;

alter table public.vendor_wallets enable row level security;
alter table public.vendor_wallet_transactions enable row level security;

drop policy if exists vendor_wallets_select_self on public.vendor_wallets;
create policy vendor_wallets_select_self
  on public.vendor_wallets for select to authenticated
  using (vendor_id = auth.uid());

drop policy if exists vendor_wallet_tx_select_self on public.vendor_wallet_transactions;
create policy vendor_wallet_tx_select_self
  on public.vendor_wallet_transactions for select to authenticated
  using (vendor_id = auth.uid());

-- Fonction securisee : credite le vendeur une seule fois par commande livree
create or replace function public.credit_vendor_for_delivered_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
  v_id uuid;
  amt numeric;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  if o.vendor_credited then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if not (
    coalesce(o.client_confirmed, false)
    or coalesce(o.reception_confirmed, false)
    or coalesce(o.buyer_confirmed, false)
  ) then
    return jsonb_build_object('ok', false, 'error', 'delivery_not_confirmed');
  end if;

  v_id := coalesce(o.vendor_id, o.seller_id, o.owner_id);
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'vendor_missing');
  end if;

  amt := coalesce(o.total_amount, o.total, o.amount, o.price, 0);
  if amt <= 0 and o.unit_price is not null and o.quantity is not null then
    amt := o.unit_price * o.quantity;
  end if;
  if amt <= 0 then
    return jsonb_build_object('ok', false, 'error', 'amount_missing');
  end if;

  insert into public.vendor_wallets (vendor_id, balance, updated_at)
  values (v_id, amt, now())
  on conflict (vendor_id) do update
    set balance = public.vendor_wallets.balance + excluded.balance,
        updated_at = now();

  if not exists (
    select 1 from public.vendor_wallet_transactions t where t.order_id = o.id
  ) then
    insert into public.vendor_wallet_transactions (vendor_id, order_id, amount, type, description)
    values (v_id, o.id, amt, 'credit_livraison', 'Livraison confirmee par le client');
  end if;

  update public.orders
  set vendor_credited = true,
      vendor_credited_at = now(),
      vendor_paid = true,
      vendeur_paye = true
  where id = o.id;

  return jsonb_build_object('ok', true, 'vendor_id', v_id, 'amount', amt);
end;
$$;

revoke all on function public.credit_vendor_for_delivered_order(uuid) from public;
grant execute on function public.credit_vendor_for_delivered_order(uuid) to authenticated;
