-- RLS page profil vendeur privé (vendza-profil-prive.html)
-- Collez dans Supabase SQL Editor.

alter table public.users enable row level security;
alter table public.vendors enable row level security;

-- Lecture profil : soi-même ou profil public vendeur
drop policy if exists profil_users_select on public.users;
create policy profil_users_select
  on public.users for select to authenticated
  using (true);

drop policy if exists profil_users_update_self on public.users;
create policy profil_users_update_self
  on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profil_vendors_select on public.vendors;
create policy profil_vendors_select
  on public.vendors for select to authenticated
  using (true);

drop policy if exists profil_vendors_upsert_self on public.vendors;
create policy profil_vendors_upsert_self
  on public.vendors for insert to authenticated
  with check (user_id = auth.uid() or id = auth.uid());

drop policy if exists profil_vendors_update_self on public.vendors;
create policy profil_vendors_update_self
  on public.vendors for update to authenticated
  using (user_id = auth.uid() or id = auth.uid())
  with check (user_id = auth.uid() or id = auth.uid());

-- Abonnement vendeur (lecture / mise à jour de son plan)
alter table public.vendor_subscriptions enable row level security;

drop policy if exists profil_sub_select_self on public.vendor_subscriptions;
create policy profil_sub_select_self
  on public.vendor_subscriptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists profil_sub_upsert_self on public.vendor_subscriptions;
create policy profil_sub_upsert_self
  on public.vendor_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists profil_sub_update_self on public.vendor_subscriptions;
create policy profil_sub_update_self
  on public.vendor_subscriptions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage avatar : bucket images, dossier {user_id}/
-- Exemple policy storage.objects (adapter le bucket si besoin) :
-- create policy profil_avatar_upload on storage.objects for insert to authenticated
--   with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
