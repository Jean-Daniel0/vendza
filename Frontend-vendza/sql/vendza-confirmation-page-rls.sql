-- =============================================================================
-- RLS pour la page « Confirmation réception » (client/confirmation.html)
-- Le client confirme la réception ; le vendeur valide ensuite via le QR sur le ticket.
-- À coller dans Supabase → SQL Editor.
-- =============================================================================

alter table public.orders add column if not exists client_confirmed boolean not null default false;
alter table public.orders add column if not exists buyer_confirmed boolean not null default false;
alter table public.orders add column if not exists reception_confirmed boolean not null default false;
alter table public.orders add column if not exists client_confirmed_at timestamptz;
alter table public.orders add column if not exists buyer_confirmed_at timestamptz;

alter table public.orders enable row level security;

drop policy if exists confirm_orders_select_participants on public.orders;
drop policy if exists confirm_orders_insert_buyer on public.orders;
drop policy if exists confirm_orders_update_participants on public.orders;
drop policy if exists confirm_orders_delete_none on public.orders;

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
    'create policy confirm_orders_select_participants on public.orders for select to authenticated using (%s)',
    participant_expr
  );
  execute format(
    'create policy confirm_orders_insert_buyer on public.orders for insert to authenticated with check (%s)',
    buyer_expr
  );
  execute format(
    'create policy confirm_orders_update_participants on public.orders for update to authenticated using (%s) with check (%s)',
    participant_expr, participant_expr
  );
  execute 'create policy confirm_orders_delete_none on public.orders for delete to authenticated using (false)';
end $$;

-- Le client lit son profil pour afficher son nom
alter table public.users enable row level security;

drop policy if exists confirm_users_select_self on public.users;
create policy confirm_users_select_self
  on public.users for select to authenticated
  using (id = auth.uid());
