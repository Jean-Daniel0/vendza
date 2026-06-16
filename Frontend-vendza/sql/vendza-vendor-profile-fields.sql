-- Champs profil vendeur (département, commune, délai, couverture Pro)
-- Exécuter une fois dans Supabase SQL Editor.

alter table public.users add column if not exists departement text;
alter table public.users add column if not exists commune text;
alter table public.users add column if not exists delai_livraison text;

alter table public.vendors add column if not exists departement text;
alter table public.vendors add column if not exists department text;
alter table public.vendors add column if not exists commune text;
alter table public.vendors add column if not exists city text;
alter table public.vendors add column if not exists delai_livraison text;
alter table public.vendors add column if not exists delivery_time text;
alter table public.vendors add column if not exists delivery_delay text;
alter table public.vendors add column if not exists coverage_departments jsonb default '[]'::jsonb;
