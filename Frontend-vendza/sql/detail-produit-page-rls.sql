-- =============================================================================
-- RLS pour la page « Détails produit » (Vendza)
-- À coller dans Supabase → SQL Editor (adapter les noms de schéma si besoin).
-- Couvre : products (lecture catalogue), reviews, conversations, messages,
-- users (profil minimal pour l’avis), bucket storage images (chemins messages).
-- Les favoris « Sauvegarder » sur cette page utilisent localStorage (pas de RLS).
-- =============================================================================

-- ─── products : lecture publique du catalogue ───────────────────────────────
alter table public.products enable row level security;

drop policy if exists "products_select_public" on public.products;
create policy "products_select_public"
  on public.products
  for select
  to anon, authenticated
  using (true);

-- Optionnel : seuls les vendeurs modifient leurs lignes (décommenter si colonne vendor_id = auth.uid())
-- drop policy if exists "products_vendor_manage" on public.products;
-- create policy "products_vendor_manage"
--   on public.products
--   for all
--   to authenticated
--   using (vendor_id = auth.uid())
--   with check (vendor_id = auth.uid());

-- ─── reviews (insert depuis detail des produits.js) ─────────────────────────
alter table public.reviews enable row level security;

drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public"
  on public.reviews
  for select
  to anon, authenticated
  using (true);

drop policy if exists "reviews_insert_owner" on public.reviews;
create policy "reviews_insert_owner"
  on public.reviews
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "reviews_update_owner" on public.reviews;
create policy "reviews_update_owner"
  on public.reviews
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "reviews_delete_owner" on public.reviews;
create policy "reviews_delete_owner"
  on public.reviews
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── users : lecture de son profil + lecture limitée pour affichage vendeur ─
alter table public.users enable row level security;

drop policy if exists "users_select_self" on public.users;
create policy "users_select_self"
  on public.users
  for select
  to authenticated
  using (id = auth.uid());

-- Optionnel (plus large) : décommenter seulement si d’autres pages listent tous les users.
-- drop policy if exists "users_select_all_authenticated" on public.users;
-- create policy "users_select_all_authenticated"
--   on public.users
--   for select
--   to authenticated
--   using (true);

-- ─── conversations (upsert buyer_id + vendor_id + product_id) ───────────────
alter table public.conversations enable row level security;

drop policy if exists "conversations_select_participants" on public.conversations;
create policy "conversations_select_participants"
  on public.conversations
  for select
  to authenticated
  using (buyer_id = auth.uid() or vendor_id = auth.uid());

drop policy if exists "conversations_insert_buyer" on public.conversations;
create policy "conversations_insert_buyer"
  on public.conversations
  for insert
  to authenticated
  with check (buyer_id = auth.uid());

drop policy if exists "conversations_update_participants" on public.conversations;
create policy "conversations_update_participants"
  on public.conversations
  for update
  to authenticated
  using (buyer_id = auth.uid() or vendor_id = auth.uid())
  with check (buyer_id = auth.uid() or vendor_id = auth.uid());

-- ─── messages ────────────────────────────────────────────────────────────────
alter table public.messages enable row level security;

drop policy if exists "messages_select_conversation_member" on public.messages;
create policy "messages_select_conversation_member"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.vendor_id = auth.uid())
    )
  );

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.vendor_id = auth.uid())
    )
  );

-- ─── Realtime : la réplication écoute souvent les mêmes règles SELECT ─────────
-- Aucun SQL ici : vérifier que la publication `supabase_realtime` inclut public.messages.

-- ─── Storage bucket `images` (upload messages : userId/messages/...) ─────────
-- Exécuter une seule fois si le bucket existe déjà.
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- Policies storage.objects pour le bucket images
drop policy if exists "images_public_read" on storage.objects;
create policy "images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'images');

drop policy if exists "images_authenticated_upload_own_folder" on storage.objects;
create policy "images_authenticated_upload_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'images'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "images_authenticated_update_own" on storage.objects;
create policy "images_authenticated_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'images'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'images'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- =============================================================================
-- Si la table reviews n’existe pas encore, schéma minimal compatible avec le JS :
-- =============================================================================
-- create table if not exists public.reviews (
--   id uuid primary key default gen_random_uuid(),
--   product_id uuid not null references public.products(id) on delete cascade,
--   user_id uuid not null references auth.users(id) on delete cascade,
--   rating int not null check (rating between 1 and 5),
--   comment text,
--   author_name text,
--   user_email text,
--   created_at timestamptz default now()
-- );
-- create index if not exists reviews_product_id_idx on public.reviews(product_id);
