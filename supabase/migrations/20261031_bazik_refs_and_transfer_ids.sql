-- 1) Identifiant Bazik de chaque paiement MonCash créé : permet de vérifier un paiement directement chez Bazik (GET /order/{orderId})
--    si la notification (webhook) n'est jamais arrivée. Écrit et lu UNIQUEMENT par le serveur (clé service).
create table if not exists public.bazik_payment_refs (
  reference_id text primary key,          -- référence envoyée à Bazik : <commande>_bz_<horodatage>
  order_ref text not null,                -- référence interne (groupe de commandes / abonnement)
  bazik_order_id text not null,           -- orderId renvoyé par Bazik à la création
  amount numeric,
  created_at timestamptz not null default now()
);
create index if not exists bazik_payment_refs_created_idx on public.bazik_payment_refs (created_at desc);
create index if not exists bazik_payment_refs_order_idx on public.bazik_payment_refs (order_ref);
alter table public.bazik_payment_refs enable row level security;
revoke all on public.bazik_payment_refs from anon, authenticated;

-- 2) Identifiant du virement Bazik (TRF_…) pour pouvoir vérifier son statut (GET /transfers/{id}) et aider le support.
alter table public.payouts add column if not exists bazik_transaction_id text;

-- 3) Le journal admin accepte aussi les rapprochements de paiements.
alter table public.admin_payment_log drop constraint if exists admin_payment_log_action_check;
alter table public.admin_payment_log add constraint admin_payment_log_action_check
  check (action in ('refund_paid', 'refund_rejected', 'reconcile_payments'));
