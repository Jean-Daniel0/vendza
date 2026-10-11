-- Appliquée sur la base de production le 2026-10-10 (documentation des changements faits depuis l'audit).
-- Objectif : aligner la base sur ce que le code attend.

-- Filet de sécurité des paiements : tout paiement non rattachable à une commande y est enregistré par le serveur.
create table if not exists public.orphaned_payments (
  id text primary key, order_id text, buyer_id text, vendor_id text,
  amount numeric default 0, payment_method text, transaction_id text,
  status text not null default 'orphaned', payload_details text,
  created_at timestamptz not null default now(), resolved_at timestamptz, resolution_note text
);
alter table public.orphaned_payments enable row level security;
create policy orphaned_payments_admin_select on public.orphaned_payments for select to authenticated using (public.is_admin());
create index if not exists idx_orphaned_payments_created on public.orphaned_payments(created_at desc);

-- Colonnes référencées par le code mais absentes de la base
alter table public.pending_orders add column if not exists checkout_group_id text;
alter table public.orders add column if not exists checkout_group_id text;
alter table public.orders add column if not exists payment_reference text;
alter table public.shops add column if not exists premium_depts text[];
create index if not exists idx_pending_orders_checkout_group on public.pending_orders(checkout_group_id);
create index if not exists idx_orders_checkout_group on public.orders(checkout_group_id);
create index if not exists idx_orders_payment_reference on public.orders(payment_reference);

-- Verrou anti double-virement (utilisé par /api/bazik/pay-vendor)
create unique index if not exists uq_payouts_reference on public.payouts(reference) where reference is not null;
