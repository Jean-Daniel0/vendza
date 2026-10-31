-- Bucket PRIVÉ pour les pièces d'identité des vendeurs.
-- Chaque utilisateur n'écrit/lit que dans son dossier <uid>/ ; l'admin peut lire. Aucun accès public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity', 'identity', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists identity_owner_insert on storage.objects;
drop policy if exists identity_owner_select on storage.objects;
drop policy if exists identity_owner_delete on storage.objects;
drop policy if exists identity_admin_select on storage.objects;

create policy identity_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'identity' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy identity_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'identity' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy identity_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'identity' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy identity_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'identity' and public.is_admin());
