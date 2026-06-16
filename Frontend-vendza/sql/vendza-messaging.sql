-- Messagerie Vendza : colonne last_message_at + index (exécuter une fois dans Supabase)
alter table public.conversations
  add column if not exists last_message_at timestamptz default now();

create index if not exists conversations_last_message_at_idx
  on public.conversations (last_message_at desc nulls last);

-- Realtime : activer la réplication pour public.messages et public.conversations
-- (Dashboard Supabase → Database → Replication)
