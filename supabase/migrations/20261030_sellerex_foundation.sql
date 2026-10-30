-- NON APPLIQUÉE. Sellerex : fournisseurs POD, connexions (clés chiffrées) et inscription grossiste.
-- À appliquer sur Supabase après relecture. Tout est fermé par défaut : le navigateur n'écrit jamais ici directement,
-- seul le serveur (clé de service) crée les connexions et les demandes.

-- ============ Fournisseurs POD ============
create table if not exists public.pod_providers (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  description text,
  auth_type   text not null default 'api_key' check (auth_type in ('api_key', 'oauth')),
  status      text not null default 'coming_soon' check (status in ('coming_soon', 'active', 'disabled')),
  created_at  timestamptz not null default now()
);
alter table public.pod_providers enable row level security;

-- Informations publiques (aucun secret) : lisibles par les utilisateurs connectés ; écriture réservée aux admins.
drop policy if exists pod_providers_select on public.pod_providers;
create policy pod_providers_select on public.pod_providers for select to authenticated using (status <> 'disabled');
drop policy if exists pod_providers_admin_all on public.pod_providers;
create policy pod_providers_admin_all on public.pod_providers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Dprinting : visible mais pas encore connectable (son API n'est pas spécifiée). Passer à 'active' quand l'adaptateur sera prêt.
insert into public.pod_providers (slug, name, description, auth_type, status)
values ('dprinting', 'Dprinting', 'Atelier d''impression Dprinting : vêtements, tasses et objets personnalisés fabriqués à la commande.', 'api_key', 'coming_soon')
on conflict (slug) do nothing;

-- ============ Connexions vendeur ↔ fournisseur ============
create table if not exists public.pod_connections (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.pod_providers(id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'revoked', 'error')),
  secret_enc  text not null,   -- clé API chiffrée (AES-256-GCM) par le serveur ; jamais lisible par le navigateur
  secret_hint text,            -- « ••••1234 » : seule chose affichable
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (vendor_id, provider_id)
);
alter table public.pod_connections enable row level security;
-- Volontairement AUCUNE règle : anon et authenticated ne peuvent rien lire ni écrire. Le serveur passe par la clé de service.
revoke all on public.pod_connections from anon, authenticated;
create index if not exists pod_connections_provider_idx on public.pod_connections (provider_id);

-- ============ Inscription grossiste ============
create table if not exists public.wholesaler_applications (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users(id) on delete cascade,
  business_name         text not null check (char_length(business_name) between 2 and 120),
  contact_name          text not null check (char_length(contact_name) between 2 and 100),
  phone                 text not null,
  whatsapp              text,
  nif                   text,
  categories            text[] not null,
  description           text not null check (char_length(description) between 20 and 1000),
  min_order_qty         integer not null check (min_order_qty between 1 and 100000),
  min_order_amount_htg  numeric(14,2) not null default 0 check (min_order_amount_htg >= 0),
  delivery_zones        text[] not null,
  status                text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note           text,
  reviewed_by           uuid references auth.users(id),
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.wholesaler_applications enable row level security;

-- Le demandeur voit sa propre demande ; il ne peut ni la créer ni la modifier lui-même (le serveur le fait), ni changer son statut.
drop policy if exists wholesaler_applications_select_own on public.wholesaler_applications;
create policy wholesaler_applications_select_own on public.wholesaler_applications for select to authenticated
  using (user_id = (select auth.uid()));
-- Les admins valident ou refusent.
drop policy if exists wholesaler_applications_admin_all on public.wholesaler_applications;
create policy wholesaler_applications_admin_all on public.wholesaler_applications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create index if not exists wholesaler_applications_status_idx on public.wholesaler_applications (status, created_at);
