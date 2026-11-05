-- Journal de l'administration : qui a consulté ou fait quoi, quand, depuis quelle adresse IP.
-- Écrit uniquement par le serveur (clé de service) ; aucune politique d'accès : personne d'autre ne peut le lire ni l'écrire.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  email text,
  action text not null,
  method text,
  path text,
  status int,
  ip text,
  detail text
);
alter table public.admin_audit_log enable row level security;
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- Journal non modifiable : ni modification ni suppression, même par le serveur.
create or replace function public.admin_audit_log_immutable() returns trigger language plpgsql as $$
begin raise exception 'admin_audit_log est en ajout seul'; end $$;
drop trigger if exists admin_audit_log_no_change on public.admin_audit_log;
create trigger admin_audit_log_no_change before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_immutable();
