-- Annulation / remboursement : tables et règles (appliquée en production le 2026-10-12).

-- 1) File de remboursements à traiter (le remboursement MonCash lui-même reste manuel : l'admin marque « paid »)
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  buyer_id uuid, vendor_id uuid,
  amount numeric not null default 0, fee numeric not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  created_at timestamptz not null default now(), paid_at timestamptz, note text
);
alter table public.refunds enable row level security;
drop policy if exists refunds_select_buyer on public.refunds;
create policy refunds_select_buyer on public.refunds for select to authenticated using (buyer_id = (select auth.uid()));
drop policy if exists refunds_admin_all on public.refunds;
create policy refunds_admin_all on public.refunds for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2) Garde : états finaux intouchables par un client, annulation seulement avant livraison, montants de remboursement conformes
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

  if new.status is distinct from old.status then
    if old.status in ('completed', 'livree', 'annulee', 'disputed') then
      raise exception 'Cette commande est dans un état final : modification refusée' using errcode = '42501';
    end if;
    if new.status = 'annulee' and old.status not in ('attente', 'payee', 'pending') then
      raise exception 'Annulation impossible dans cet état' using errcode = '42501';
    end if;
  end if;

  if new.montant_rembourse is distinct from old.montant_rembourse or new.frais_annulation is distinct from old.frais_annulation then
    if abs(coalesce(new.frais_annulation, 0) - round(coalesce(new.total_price, 0) * 0.075, 2)) > 0.02
       or abs(coalesce(new.montant_rembourse, 0) - (coalesce(new.total_price, 0) - coalesce(new.frais_annulation, 0))) > 0.02 then
      raise exception 'Montant de remboursement non conforme (frais retenus : 7,5 %%)' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.orders_guard_sensitive() from public, anon, authenticated;

-- 3) Annulation d'une commande PAYÉE : file de remboursement + annulation de l'escrow du vendeur (une seule fois)
create or replace function public.orders_on_cancel() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_vendor uuid; v_net numeric; v_new_refund int;
begin
  if new.status = 'annulee' and old.status = 'payee' then
    v_vendor := coalesce(new.vendor_id, new.seller_id, new.owner_id);

    insert into public.refunds (order_id, buyer_id, vendor_id, amount, fee)
    values (new.id, coalesce(new.buyer_id, new.user_id, new.client_id, new.customer_id), v_vendor,
            coalesce(new.montant_rembourse, round(coalesce(new.total_price, 0) * 0.925, 2)),
            coalesce(new.frais_annulation, round(coalesce(new.total_price, 0) * 0.075, 2)))
    on conflict (order_id) do nothing;
    get diagnostics v_new_refund = row_count;

    -- L'escrow n'est annulé qu'une seule fois (quand la ligne de remboursement vient d'être créée).
    -- NB : vendor_wallet_transactions a une contrainte UNIQUE(order_id) ; la ligne d'annulation est donc liée à la commande dans sa description.
    if v_new_refund = 1 then
      select amount into v_net from public.vendor_wallet_transactions
       where order_id = new.id and type = 'pending_escrow' limit 1;
      if v_net is not null and v_net > 0 and v_vendor is not null then
        update public.vendor_wallets
           set pending_balance = greatest(0, coalesce(pending_balance, 0) - v_net),
               total_earned = greatest(0, coalesce(total_earned, 0) - v_net), updated_at = now()
         where vendor_id = v_vendor;
        insert into public.vendor_wallet_transactions (vendor_id, order_id, amount, type, description)
        values (v_vendor, null, -v_net, 'escrow_reversal', 'Commande ' || new.id || ' annulée par l''acheteur : escrow annulé');
      end if;
    end if;
  end if;
  return null;
end $$;
revoke execute on function public.orders_on_cancel() from public, anon, authenticated;
drop trigger if exists trg_orders_on_cancel on public.orders;
create trigger trg_orders_on_cancel after update on public.orders for each row execute function public.orders_on_cancel();
