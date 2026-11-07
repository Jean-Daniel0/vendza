-- Prix barrés honnêtes : un « ancien prix » n'est affiché que s'il a réellement été le prix du produit
-- pendant au moins 14 jours au cours des 60 derniers jours. Une promotion dure 30 jours.
-- Les promotions déjà en ligne gardent 14 jours de transition (jusqu'au 14 jours après l'exécution de ce script).

create table if not exists public.product_price_history (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists product_price_history_product_idx on public.product_price_history (product_id, started_at desc);
alter table public.product_price_history enable row level security;  -- aucune politique : lecture/écriture par le serveur uniquement

alter table public.products add column if not exists old_price_declared numeric;
alter table public.products add column if not exists promo_status text;      -- verifiee | transition | refusee | expiree
alter table public.products add column if not exists promo_expires_at timestamptz;

-- Historique de départ : le prix actuel de chaque produit est en vigueur depuis sa création
insert into public.product_price_history (product_id, price, started_at)
select p.id, p.price, coalesce(p.created_at, now()) from public.products p
where not exists (select 1 from public.product_price_history h where h.product_id = p.id);

-- Promotions existantes : 14 jours de transition
update public.products set old_price_declared = old_price, promo_status = 'transition', promo_expires_at = now() + interval '14 days'
where old_price is not null and old_price > price and promo_status is null;

create or replace function public.products_promo_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  declared numeric;
  changed boolean;
  backed boolean;
begin
  -- Passage interne (purge des promotions expirées)
  if coalesce(current_setting('vendza.skip_promo_guard', true), '') = '1' then return new; end if;

  -- Historique des prix
  if tg_op = 'INSERT' then
    changed := true;  -- le premier prix est enregistré après l'insertion (trigger ci-dessous)
  else
    if new.price is distinct from old.price then
      update public.product_price_history set ended_at = now() where product_id = new.id and ended_at is null;
      insert into public.product_price_history (product_id, price) values (new.id, new.price);
    end if;
    changed := new.old_price is distinct from old.old_price or new.price is distinct from old.price;
    if not changed then
      -- Les champs de contrôle ne sont jamais modifiables directement par un vendeur
      new.old_price_declared := old.old_price_declared;
      new.promo_status := old.promo_status;
      new.promo_expires_at := old.promo_expires_at;
      return new;
    end if;
  end if;

  declared := new.old_price;
  if declared is null or declared <= new.price then
    new.old_price := null; new.old_price_declared := declared; new.promo_status := null; new.promo_expires_at := null;
    return new;
  end if;

  select exists (
    select 1 from public.product_price_history h
    where h.product_id = new.id and h.price = declared
      and coalesce(h.ended_at, now()) >= now() - interval '60 days'
      and coalesce(h.ended_at, now()) - h.started_at >= interval '14 days'
  ) into backed;

  new.old_price_declared := declared;
  if backed then
    new.promo_status := 'verifiee';
    new.promo_expires_at := now() + interval '30 days';
  else
    new.old_price := null; new.promo_status := 'refusee'; new.promo_expires_at := null;
  end if;
  return new;
end $$;

drop trigger if exists products_promo_guard on public.products;
create trigger products_promo_guard before insert or update on public.products
  for each row execute function public.products_promo_guard();

-- Premier prix d'un nouveau produit
create or replace function public.products_price_history_init() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.product_price_history (product_id, price) values (new.id, new.price);
  return null;
end $$;
drop trigger if exists products_price_history_init on public.products;
create trigger products_price_history_init after insert on public.products
  for each row execute function public.products_price_history_init();

-- Purge des promotions arrivées à échéance (appelée par le serveur)
create or replace function public.expire_promos() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform set_config('vendza.skip_promo_guard', '1', true);
  update public.products set old_price = null, promo_status = 'expiree'
  where old_price is not null and promo_expires_at is not null and promo_expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.expire_promos() from public, anon, authenticated;
grant execute on function public.expire_promos() to service_role;
