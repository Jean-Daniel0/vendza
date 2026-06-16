-- Routage commande vers le vendeur proprietaire du produit (client/panier.js)
-- Chaque commande doit porter vendor_id (et seller_id / owner_id si presentes).
-- A coller dans Supabase -> SQL Editor (apres vendza-confirmation-page-rls.sql si besoin).

alter table public.orders add column if not exists vendor_id uuid references auth.users(id);
alter table public.orders add column if not exists seller_id uuid references auth.users(id);
alter table public.orders add column if not exists owner_id uuid references auth.users(id);
alter table public.orders add column if not exists product_id uuid references public.products(id);
alter table public.orders add column if not exists buyer_id uuid references auth.users(id);
alter table public.orders add column if not exists client_id uuid references auth.users(id);
alter table public.orders add column if not exists product_name text;
alter table public.orders add column if not exists vendor_name text;

alter table public.orders enable row level security;

-- Acheteur : cree une commande pour lui-meme avec un vendeur renseigne
drop policy if exists orders_insert_buyer_with_vendor on public.orders;
create policy orders_insert_buyer_with_vendor
  on public.orders for insert to authenticated
  with check (
    (
      buyer_id = auth.uid()
      or client_id = auth.uid()
      or user_id = auth.uid()
    )
    and (
      vendor_id is not null
      or seller_id is not null
      or owner_id is not null
    )
  );

-- Vendeur : lit et met a jour les commandes qui lui sont assignees
drop policy if exists orders_select_vendor on public.orders;
create policy orders_select_vendor
  on public.orders for select to authenticated
  using (
    vendor_id = auth.uid()
    or seller_id = auth.uid()
    or owner_id = auth.uid()
  );

drop policy if exists orders_update_vendor on public.orders;
create policy orders_update_vendor
  on public.orders for update to authenticated
  using (
    vendor_id = auth.uid()
    or seller_id = auth.uid()
    or owner_id = auth.uid()
  )
  with check (
    vendor_id = auth.uid()
    or seller_id = auth.uid()
    or owner_id = auth.uid()
  );

-- Acheteur : lit ses propres commandes
drop policy if exists orders_select_buyer on public.orders;
create policy orders_select_buyer
  on public.orders for select to authenticated
  using (
    buyer_id = auth.uid()
    or client_id = auth.uid()
    or user_id = auth.uid()
    or customer_id = auth.uid()
  );

-- Optionnel : verifier que vendor_id correspond au produit commande
-- (decommenter si product_id est toujours renseigne a la commande)
/*
create or replace function public.order_vendor_matches_product()
returns trigger language plpgsql as $$
declare pid uuid;
declare pv uuid;
begin
  if new.product_id is null then return new; end if;
  select vendor_id into pv from public.products where id = new.product_id;
  if pv is null then return new; end if;
  if new.vendor_id is not null and new.vendor_id <> pv then
    raise exception 'vendor_id ne correspond pas au produit';
  end if;
  new.vendor_id := coalesce(new.vendor_id, pv);
  new.seller_id := coalesce(new.seller_id, pv);
  return new;
end;
$$;

drop trigger if exists trg_order_vendor_product on public.orders;
create trigger trg_order_vendor_product
  before insert on public.orders
  for each row execute function public.order_vendor_matches_product();
*/
