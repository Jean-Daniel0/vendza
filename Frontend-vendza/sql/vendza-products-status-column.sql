-- Colonnes optionnelles pour brouillon / publication (si absentes en base)
alter table public.products add column if not exists status text default 'published';
alter table public.products add column if not exists is_active boolean default true;
