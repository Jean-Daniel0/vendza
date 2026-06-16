-- RLS page Mes produits vendeur (vendeur/mes produit.html)
-- Permet au vendeur connecte de gerer uniquement ses propres produits.

alter table public.products enable row level security;

drop policy if exists mes_produits_vendor_select on public.products;
create policy mes_produits_vendor_select
  on public.products for select to authenticated
  using (vendor_id = auth.uid());

drop policy if exists mes_produits_vendor_insert on public.products;
create policy mes_produits_vendor_insert
  on public.products for insert to authenticated
  with check (vendor_id = auth.uid());

drop policy if exists mes_produits_vendor_update on public.products;
create policy mes_produits_vendor_update
  on public.products for update to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

drop policy if exists mes_produits_vendor_delete on public.products;
create policy mes_produits_vendor_delete
  on public.products for delete to authenticated
  using (vendor_id = auth.uid());

-- Si votre colonne vendeur s'appelle seller_id au lieu de vendor_id, adaptez :
-- using (seller_id = auth.uid())  et  with check (seller_id = auth.uid())
