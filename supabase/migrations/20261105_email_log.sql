-- Journal des e-mails envoyés : une ligne par (événement, destinataire, commande) pour ne jamais envoyer deux fois
-- le même e-mail (webhook rejoué, double clic). Écrit et lu UNIQUEMENT par le serveur (clé service). Aucune adresse e-mail n'est stockée.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  dedupe_key text not null unique,
  event text not null,
  user_id uuid,
  provider_id text
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
