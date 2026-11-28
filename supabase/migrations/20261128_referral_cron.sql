-- Rattrapage nocturne des gains de parrainage (idempotent : un seul gain par commande, grâce à l'index unique).
-- Même modèle que les autres tâches ; relancer ce script est sans danger.
select cron.schedule('vendza-referral-sweep', '0 8 * * *', $$
  select net.http_post(
    url := 'https://www.vendza.store/api/internal/cron/run?task=referral-sweep',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_secrets where name='cron')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);   -- 3h (Haïti)
