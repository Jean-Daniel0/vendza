-- Bloquer l'achat de ses propres produits (Supabase SQL Editor)

create or replace function public.orders_block_self_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer uuid;
  seller uuid;
begin
  buyer := coalesce(new.buyer_id, new.client_id, new.customer_id, new.user_id);
  seller := coalesce(new.vendor_id, new.seller_id, new.owner_id);

  if buyer is null or seller is null then
    return new;
  end if;

  if buyer = seller then
    raise exception 'Vous ne pouvez pas acheter vos propres produits.';
  end if;

  if exists (
    select 1
    from public.vendors v
    where v.user_id = buyer
      and (v.id = seller or v.user_id = seller)
  ) then
    raise exception 'Vous ne pouvez pas acheter vos propres produits.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_block_self_purchase on public.orders;

create trigger trg_orders_block_self_purchase
  before insert on public.orders
  for each row
  execute function public.orders_block_self_purchase();
