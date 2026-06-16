-- =============================================================================
-- RLS pour la page « Ticket de commande » (client/vendza-ticket.html)
-- À coller dans Supabase → SQL Editor (une seule exécution).
-- =============================================================================

create extension if not exists pgcrypto;

-- Colonnes utiles au ticket
alter table public.orders add column if not exists shipping_fee numeric default 0;
alter table public.orders add column if not exists delivery_commune text;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists client_name text;
alter table public.orders add column if not exists items jsonb;
alter table public.orders add column if not exists buyer_id uuid;
alter table public.orders add column if not exists client_id uuid;
alter table public.orders add column if not exists customer_id uuid;
alter table public.orders add column if not exists seller_id uuid;
alter table public.orders add column if not exists owner_id uuid;
alter table public.orders add column if not exists qr_code text;
alter table public.orders add column if not exists qr_token text;
alter table public.orders add column if not exists qr_payload text;
alter table public.orders add column if not exists validation_code text;
alter table public.orders add column if not exists is_validated boolean not null default false;

update public.orders
set qr_code = 'pending:' || gen_random_uuid()::text
where qr_code is null or btrim(qr_code) = '';

alter table public.orders enable row level security;

drop policy if exists ticket_orders_select_participants on public.orders;
drop policy if exists ticket_orders_insert_buyer on public.orders;
drop policy if exists ticket_orders_update_participants on public.orders;
drop policy if exists ticket_orders_delete_none on public.orders;

do $$
declare
  cols text[] := array['user_id','buyer_id','client_id','customer_id','vendor_id','seller_id','owner_id'];
  c text;
  buyer_expr text := '';
  vendor_expr text := '';
  participant_expr text := '';
begin
  foreach c in array cols loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = c
    ) then
      if c in ('user_id','buyer_id','client_id','customer_id') then
        buyer_expr := buyer_expr || case when buyer_expr <> '' then ' or ' else '' end
          || format('auth.uid() = %I', c);
      else
        vendor_expr := vendor_expr || case when vendor_expr <> '' then ' or ' else '' end
          || format('auth.uid() = %I', c);
      end if;
    end if;
  end loop;

  participant_expr := trim(both ' ' from concat(
    case when buyer_expr <> '' then '(' || buyer_expr || ')' else '' end,
    case when buyer_expr <> '' and vendor_expr <> '' then ' or ' else '' end,
    case when vendor_expr <> '' then '(' || vendor_expr || ')' else '' end
  ));

  if participant_expr = '' then participant_expr := 'false'; end if;
  if buyer_expr = '' then buyer_expr := 'true'; end if;

  execute format(
    'create policy ticket_orders_select_participants on public.orders for select to authenticated using (%s)',
    participant_expr
  );
  execute format(
    'create policy ticket_orders_insert_buyer on public.orders for insert to authenticated with check (%s)',
    buyer_expr
  );
  execute format(
    'create policy ticket_orders_update_participants on public.orders for update to authenticated using (%s) with check (%s)',
    participant_expr, participant_expr
  );
  execute 'create policy ticket_orders_delete_none on public.orders for delete to authenticated using (false)';
end $$;

-- Profil client / vendeur pour le ticket
alter table public.users enable row level security;

drop policy if exists ticket_users_select_self on public.users;
create policy ticket_users_select_self
  on public.users for select to authenticated
  using (id = auth.uid());

drop policy if exists ticket_users_select_order_counterparty on public.users;
create policy ticket_users_select_order_counterparty
  on public.users for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where (o.vendor_id = auth.uid() and o.user_id = users.id)
         or (o.user_id = auth.uid() and o.vendor_id = users.id)
    )
  );

alter table public.products enable row level security;

drop policy if exists ticket_products_select_public on public.products;
create policy ticket_products_select_public
  on public.products for select to anon, authenticated
  using (true);

create index if not exists orders_id_idx on public.orders (id);
create index if not exists orders_qr_code_idx on public.orders (qr_code);
