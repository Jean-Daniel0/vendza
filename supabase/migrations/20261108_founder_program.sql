-- Programme fondateurs : 50 places, réparties à parts égales entre les catégories.
-- Avantage : -90 % sur la commission Vendza pendant 90 jours à partir de l'inscription.
create table if not exists public.founder_program (
  vendor_id uuid primary key references auth.users(id) on delete cascade,
  category text not null,
  joined_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);
create index if not exists founder_program_category_idx on public.founder_program(category);

alter table public.founder_program enable row level security;
drop policy if exists founder_own_select on public.founder_program;
drop policy if exists founder_admin_select on public.founder_program;
create policy founder_own_select on public.founder_program for select to authenticated
  using (vendor_id = (select auth.uid()));
create policy founder_admin_select on public.founder_program for select to authenticated
  using (public.is_admin());
-- Aucune écriture directe : tout passe par claim_founder_spot (service_role uniquement).
revoke all on public.founder_program from anon, authenticated;
grant select on public.founder_program to authenticated;

-- Places restantes (public : sert au compteur, ne révèle aucun vendeur).
create or replace function public.founder_spots()
returns table(category text, taken int)
language sql stable security definer set search_path = public as $$
  select category, count(*)::int from public.founder_program group by category;
$$;
revoke all on function public.founder_spots() from public;
grant execute on function public.founder_spots() to anon, authenticated, service_role;

-- Réservation d'une place. Appelée par le serveur uniquement.
create or replace function public.claim_founder_spot(p_vendor uuid, p_category text, p_total int, p_per_category int, p_min_products int)
returns text
language plpgsql security definer set search_path = public as $$
declare v_total int; v_cat int; v_products int; v_status text;
begin
  perform pg_advisory_xact_lock(hashtext('founder_program'));
  if exists (select 1 from public.founder_program where vendor_id = p_vendor) then return 'deja_inscrit'; end if;
  select lower(coalesce(statut_verification,'')) into v_status from public.shops where vendor_id = p_vendor;
  if v_status is distinct from 'verifie' then return 'identite_non_verifiee'; end if;
  select count(*) into v_products from public.products where vendor_id = p_vendor and coalesce(is_active, true) = true;
  if v_products < p_min_products then return 'produits_insuffisants'; end if;
  select count(*) into v_total from public.founder_program;
  if v_total >= p_total then return 'complet'; end if;
  select count(*) into v_cat from public.founder_program where category = p_category;
  if v_cat >= p_per_category then return 'categorie_complete'; end if;
  insert into public.founder_program(vendor_id, category) values (p_vendor, p_category);
  return 'ok';
end $$;
revoke all on function public.claim_founder_spot(uuid, text, int, int, int) from public, anon, authenticated;
grant execute on function public.claim_founder_spot(uuid, text, int, int, int) to service_role;

-- Commission réellement appliquée, gardée sur la commande pour le suivi du coût.
alter table public.orders add column if not exists commission_rate_applied numeric;
alter table public.orders add column if not exists founder_discount boolean not null default false;
