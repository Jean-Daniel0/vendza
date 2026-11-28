-- Parrainage Vendza : tables, registre immuable, sécurité (déjà exécuté dans Supabase le 28/11/2026)
create table if not exists public.referral_codes (
  vendor_id  uuid primary key references public.profiles(id) on delete cascade,
  code       text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid not null references public.profiles(id) on delete cascade,
  referee_id    uuid not null unique references public.profiles(id) on delete cascade,
  code          text not null,
  utm_source    text,
  utm_campaign  text,
  status        text not null default 'pending' check (status in ('pending','active','blocked','rejected')),
  reject_reason text,
  first_sale_at timestamptz,
  last_sale_at  timestamptz,
  created_at    timestamptz not null default now(),
  check (referrer_id <> referee_id)
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
create table if not exists public.referral_earnings (
  id              uuid primary key default gen_random_uuid(),
  referral_id     uuid not null references public.referrals(id),
  referrer_id     uuid not null references public.profiles(id),
  order_id        text,
  kind            text not null check (kind in ('earn','reversal','payout')),
  rate            numeric(6,4),
  commission_base numeric(14,2),
  amount          numeric(14,2) not null,
  reference       text,
  note            text,
  created_at      timestamptz not null default now(),
  check ((kind = 'earn' and amount > 0) or (kind in ('reversal','payout') and amount < 0))
);
create unique index if not exists referral_earn_once  on public.referral_earnings(order_id) where kind = 'earn';
create unique index if not exists referral_rev_once   on public.referral_earnings(order_id) where kind = 'reversal';
create index if not exists referral_earn_referrer_idx on public.referral_earnings(referrer_id, created_at);
create or replace function public.referral_earnings_immutable() returns trigger
language plpgsql as $$ begin raise exception 'referral_earnings est un registre immuable'; end $$;
drop trigger if exists referral_earnings_no_change on public.referral_earnings;
create trigger referral_earnings_no_change before update or delete on public.referral_earnings
  for each row execute function public.referral_earnings_immutable();
alter table public.referral_codes    enable row level security;
alter table public.referrals         enable row level security;
alter table public.referral_earnings enable row level security;
drop policy if exists "Le vendeur voit son code" on public.referral_codes;
create policy "Le vendeur voit son code" on public.referral_codes for select using (vendor_id = auth.uid());
drop policy if exists "Le parrain voit ses filleuls" on public.referrals;
create policy "Le parrain voit ses filleuls" on public.referrals for select using (referrer_id = auth.uid());
drop policy if exists "Le parrain voit ses gains" on public.referral_earnings;
create policy "Le parrain voit ses gains" on public.referral_earnings for select using (referrer_id = auth.uid());
revoke all on public.referral_codes, public.referrals, public.referral_earnings from anon;
revoke insert, update, delete on public.referral_codes, public.referrals, public.referral_earnings from authenticated;
