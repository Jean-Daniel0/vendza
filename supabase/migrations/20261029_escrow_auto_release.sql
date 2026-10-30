-- Libération automatique de l'escrow (voir docs/ESCROW.md). Colonne appliquée ; la tâche planifiée est créée après le déploiement du code.
alter table public.orders add column if not exists auto_released_at timestamptz;

-- À créer une fois le code déployé (1 fois par jour, 15 h UTC = 10 h-11 h en Haïti) :
-- select cron.schedule('vendza-escrow-release', '0 15 * * *', $job$
--   select net.http_post(url := 'https://www.vendza.store/api/internal/cron/run?task=escrow-release',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_secrets where name='cron')),
--     body := '{}'::jsonb, timeout_milliseconds := 60000);
-- $job$);
