-- RLS page profil vendeur public (client/profil-vendeur.html)
-- Permet aux visiteurs (anon + connectés) de lire les infos vendeur affichées publiquement.

alter table public.users enable row level security;
alter table public.vendors enable row level security;

drop policy if exists profil_public_users_select_anon on public.users;
create policy profil_public_users_select_anon
  on public.users for select to anon
  using (true);

drop policy if exists profil_public_vendors_select_anon on public.vendors;
create policy profil_public_vendors_select_anon
  on public.vendors for select to anon
  using (true);

-- Storage : lecture publique des images vendeur (avatars, couvertures)
-- À activer si le bucket images n'est pas déjà public en lecture.
-- create policy profil_public_images_read on storage.objects
--   for select to anon, authenticated
--   using (bucket_id = 'images');
