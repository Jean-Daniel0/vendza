-- Zone produit (departement + commune) — page Creer un produit (vendeur/produit.html)
-- A coller dans Supabase -> SQL Editor.

alter table public.products add column if not exists departement text;
alter table public.products add column if not exists department text;
alter table public.products add column if not exists dept text;
alter table public.products add column if not exists commune text;
alter table public.products add column if not exists city text;
alter table public.products add column if not exists delivery_time text;
alter table public.products add column if not exists vendor_id uuid references auth.users(id);

-- Lecture publique du catalogue (filtres accueil + detail produit)
alter table public.products enable row level security;

drop policy if exists produit_zone_select_public on public.products;
create policy produit_zone_select_public
  on public.products for select to anon, authenticated
  using (true);

-- Le vendeur gere ses lignes (complement de vendza-mes-produits-rls.sql)
drop policy if exists produit_zone_vendor_insert on public.products;
create policy produit_zone_vendor_insert
  on public.products for insert to authenticated
  with check (vendor_id = auth.uid());

drop policy if exists produit_zone_vendor_update on public.products;
create policy produit_zone_vendor_update
  on public.products for update to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());
