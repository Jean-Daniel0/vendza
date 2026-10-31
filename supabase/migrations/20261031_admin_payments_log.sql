-- Journal des opérations admin sur l'argent (remboursements marqués payés / refusés).
-- Écrit UNIQUEMENT par le serveur (clé service) ; l'admin le lit ; personne ne peut le modifier ni l'effacer depuis le navigateur.
create table if not exists public.admin_payment_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid not null,
  admin_email text,
  action text not null check (action in ('refund_paid', 'refund_rejected')),
  refund_id uuid,
  order_id uuid,
  amount numeric,
  reference text,
  note text
);
create index if not exists admin_payment_log_created_idx on public.admin_payment_log (created_at desc);
create index if not exists admin_payment_log_order_idx on public.admin_payment_log (order_id);

alter table public.admin_payment_log enable row level security;
drop policy if exists admin_payment_log_admin_select on public.admin_payment_log;
create policy admin_payment_log_admin_select on public.admin_payment_log
  for select to authenticated using (public.is_admin());
-- Aucune règle insert / update / delete : seul le serveur (service_role) écrit.
revoke insert, update, delete on public.admin_payment_log from anon, authenticated;
revoke all on public.admin_payment_log from anon;
