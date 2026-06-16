-- Abonnements vendeur Vendza (plans free / pro-350 / elite-499)
-- À exécuter dans Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.vendor_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null default 'free'
    check (plan_code in ('free', 'pro-350', 'elite-499')),
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled')),
  billing text default 'mensuel',
  departments jsonb default '[]'::jsonb,
  benefits jsonb default '{}'::jsonb,
  payment_method text,
  total_paid numeric(12, 2) default 0,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendor_subscriptions add column if not exists billing text default 'mensuel';
alter table public.vendor_subscriptions add column if not exists departments jsonb default '[]'::jsonb;
alter table public.vendor_subscriptions add column if not exists benefits jsonb default '{}'::jsonb;
alter table public.vendor_subscriptions add column if not exists payment_method text;
alter table public.vendor_subscriptions add column if not exists total_paid numeric(12, 2) default 0;

create unique index if not exists vendor_subscriptions_user_unique
  on public.vendor_subscriptions (user_id);

create index if not exists vendor_subscriptions_expires_idx
  on public.vendor_subscriptions (expires_at);

alter table public.vendor_subscriptions enable row level security;

-- Vendeur : lire / modifier son abonnement
drop policy if exists vendor_subscriptions_select_own on public.vendor_subscriptions;
create policy vendor_subscriptions_select_own
  on public.vendor_subscriptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists vendor_subscriptions_insert_own on public.vendor_subscriptions;
create policy vendor_subscriptions_insert_own
  on public.vendor_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists vendor_subscriptions_update_own on public.vendor_subscriptions;
create policy vendor_subscriptions_update_own
  on public.vendor_subscriptions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Catalogue public : badge Pro visible pour les plans actifs (lecture seule)
drop policy if exists vendor_subscriptions_select_public_pro on public.vendor_subscriptions;
create policy vendor_subscriptions_select_public_pro
  on public.vendor_subscriptions for select to anon, authenticated
  using (
    status = 'active'
    and plan_code in ('pro-350', 'elite-499')
    and (expires_at is null or expires_at > now())
  );

-- Colonnes vendeur pour badge / plan (si absentes)
alter table public.vendors add column if not exists plan_code text;
alter table public.vendors add column if not exists is_pro boolean default false;
alter table public.vendors add column if not exists is_verified boolean default false;
alter table public.vendors add column if not exists verified boolean default false;
alter table public.vendors add column if not exists coverage_departments jsonb default '[]'::jsonb;
