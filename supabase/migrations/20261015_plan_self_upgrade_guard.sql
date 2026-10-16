-- Plans / vérification : un client ne peut plus s'attribuer un plan payant, un badge « vérifié » ou un solde (seul le serveur le peut).
-- Les vrais upgrades passent par le paiement -> webhook -> activerAbonnement() (service_role).

create or replace function public.profiles_guard_plan() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.plan is distinct from old.plan and lower(coalesce(new.plan, 'gratuit')) not in ('gratuit', 'free') then
    raise exception 'Un plan payant ne peut être activé que par le serveur après paiement' using errcode = '42501';
  end if;
  if new.plan_expires_at is distinct from old.plan_expires_at and lower(coalesce(new.plan, 'gratuit')) not in ('gratuit', 'free') then
    raise exception 'Date d''expiration réservée au serveur' using errcode = '42501';
  end if;
  if new.statut_verification is distinct from old.statut_verification and coalesce(new.statut_verification, 'non_verifie') not in ('non_verifie', 'en_attente') then
    raise exception 'Le statut de vérification est réservé à l''administration' using errcode = '42501';
  end if;
  if new.revenus_bloques is distinct from old.revenus_bloques then
    raise exception 'Champ réservé au serveur' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.profiles_guard_plan() from public, anon, authenticated;
drop trigger if exists trg_profiles_guard_plan on public.profiles;
create trigger trg_profiles_guard_plan before update on public.profiles for each row execute function public.profiles_guard_plan();

create or replace function public.shops_guard_plan() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.plan is distinct from old.plan and lower(coalesce(new.plan, 'gratuit')) not in ('gratuit', 'free') then
    raise exception 'Un plan payant ne peut être activé que par le serveur après paiement' using errcode = '42501';
  end if;
  if new.boost_score is distinct from old.boost_score and coalesce(new.boost_score, 0) > coalesce(old.boost_score, 0) then
    raise exception 'Champ réservé au serveur' using errcode = '42501';
  end if;
  if new.is_featured is distinct from old.is_featured and coalesce(new.is_featured, false) then
    raise exception 'Champ réservé au serveur' using errcode = '42501';
  end if;
  if new.statut_verification is distinct from old.statut_verification and coalesce(new.statut_verification, 'non_verifie') not in ('non_verifie', 'en_attente') then
    raise exception 'Le statut de vérification est réservé à l''administration' using errcode = '42501';
  end if;
  if new.revenus_bloques is distinct from old.revenus_bloques then
    raise exception 'Champ réservé au serveur' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.shops_guard_plan() from public, anon, authenticated;
drop trigger if exists trg_shops_guard_plan on public.shops;
create trigger trg_shops_guard_plan before update on public.shops for each row execute function public.shops_guard_plan();

create or replace function public.vendor_subscriptions_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if lower(coalesce(new.plan_code, 'gratuit')) not in ('gratuit', 'free') then
      raise exception 'Un abonnement payant ne peut être créé que par le serveur après paiement' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status is distinct from 'cancelled'
     or (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Un abonnement ne peut être que résilié depuis le navigateur' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.vendor_subscriptions_guard() from public, anon, authenticated;
drop trigger if exists trg_vendor_subscriptions_guard on public.vendor_subscriptions;
create trigger trg_vendor_subscriptions_guard before insert or update on public.vendor_subscriptions for each row execute function public.vendor_subscriptions_guard();

-- Rattrapage (NON APPLIQUÉ : décision métier en attente) : plan payant sans abonnement actif et non expiré -> plan gratuit.
-- Concerne 1 vendeur (b0e0…, plan pro_local avec un abonnement 'elite-499' expiré le 2026-06-18). Il change la commission (15 % -> 20 %).
-- update public.profiles p set plan = 'gratuit', plan_expires_at = null, updated_at = now()
--  where lower(coalesce(p.plan, 'gratuit')) not in ('gratuit', 'free')
--    and not exists (select 1 from public.vendor_subscriptions s where s.user_id = p.id and s.status = 'active' and s.expires_at > now());
-- update public.shops s set plan = 'gratuit', boost_score = 0, is_featured = false, updated_at = now()
--  where lower(coalesce(s.plan, 'gratuit')) not in ('gratuit', 'free')
--    and not exists (select 1 from public.vendor_subscriptions v where v.user_id = s.vendor_id and v.status = 'active' and v.expires_at > now());
