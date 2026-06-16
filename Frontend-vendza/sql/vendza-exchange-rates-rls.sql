-- Table des taux de change (Gourdes HTG / USD) et politiques RLS
-- À exécuter dans le SQL Editor de votre projet Supabase.

-- 1. Création de la table si elle n'existe pas déjà
create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  usd_to_htg numeric(10, 2) not null default 130.00,
  updated_at timestamptz not null default now()
);

-- 2. Activer la sécurité niveau lignes (RLS)
alter table public.exchange_rates enable row level security;

-- 3. Politique : Permettre la lecture publique (anon et authenticated) du taux de change
drop policy if exists exchange_rates_select_public on public.exchange_rates;
create policy exchange_rates_select_public
  on public.exchange_rates for select to anon, authenticated
  using (true);

-- 4. Politique : Permettre l'insertion par le client anonyme (si la clé service_role n'est pas configurée)
drop policy if exists exchange_rates_insert_public on public.exchange_rates;
create policy exchange_rates_insert_public
  on public.exchange_rates for insert to anon, authenticated
  with check (true);

-- 5. Politique : Permettre la mise à jour par le client anonyme (si la clé service_role n'est pas configurée)
drop policy if exists exchange_rates_update_public on public.exchange_rates;
create policy exchange_rates_update_public
  on public.exchange_rates for update to anon, authenticated
  using (true)
  with check (true);

-- 6. Insérer un taux initial par défaut si la table est vide
insert into public.exchange_rates (usd_to_htg, updated_at)
select 130.00, now()
where not exists (select 1 from public.exchange_rates);
