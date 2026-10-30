-- Appliquée sur Supabase (migration « subscriptions_server_only »).
-- Les vrais codes de forfait écrits par le serveur étaient refusés par l'ancienne contrainte : l'insertion échouait en silence.
alter table public.vendor_subscriptions drop constraint if exists vendor_subscriptions_plan_code_check;
alter table public.vendor_subscriptions add constraint vendor_subscriptions_plan_code_check
  check (plan_code = any (array['free','gratuit','pro-350','elite-499','pro_local','pro_national']));

-- Identifiant du paiement : un même paiement (webhook + vérification de session) n'active l'abonnement qu'une fois.
alter table public.vendor_subscriptions add column if not exists payment_reference text;
create unique index if not exists vendor_subscriptions_payment_reference_uq on public.vendor_subscriptions (payment_reference) where payment_reference is not null;

-- Écriture réservée au serveur (clé de service) : un vendeur ne peut plus créer, modifier ni supprimer sa propre ligne d'abonnement.
drop policy if exists vendor_subscriptions_insert_own on public.vendor_subscriptions;
drop policy if exists vendor_subscriptions_update_own on public.vendor_subscriptions;
drop policy if exists vendor_subscriptions_delete_own on public.vendor_subscriptions;
revoke insert, update, delete on public.vendor_subscriptions from anon, authenticated;

drop policy if exists vendor_subscriptions_select_public_pro on public.vendor_subscriptions;
create policy vendor_subscriptions_select_public_pro on public.vendor_subscriptions for select to anon, authenticated
  using (status = 'active' and plan_code = any (array['pro-350','elite-499','pro_local','pro_national']) and (expires_at is null or expires_at > now()));
