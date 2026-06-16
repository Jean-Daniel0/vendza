-- Table avis produits (compatible vendza-reviews.js)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  content text,
  author_name text,
  user_email text,
  vendor_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists reviews_product_id_idx on public.reviews(product_id);
create index if not exists reviews_user_id_idx on public.reviews(user_id);

alter table public.reviews enable row level security;

drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public"
  on public.reviews for select to anon, authenticated using (true);

drop policy if exists "reviews_insert_owner" on public.reviews;
create policy "reviews_insert_owner"
  on public.reviews for insert to authenticated
  with check (user_id = auth.uid());
