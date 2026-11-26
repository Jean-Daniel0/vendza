-- Messages de la journée (heure d'Haïti = UTC-5). Chaque tâche ne s'envoie qu'une fois par jour et ne tourne que dans sa plage
-- horaire ; sans contenu réel, elle n'envoie rien. Même modèle que les tâches existantes (vendza-recommendations, etc.).
-- Relancer ce script est sans danger : cron.schedule remplace une tâche du même nom.

select cron.schedule('vendza-new-today', '0 14 * * *', $$
  select net.http_post(
    url := 'https://www.vendza.store/api/internal/cron/run?task=new-today',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_secrets where name='cron')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);   -- 9h : nouveautés du jour

select cron.schedule('vendza-delivery-reminder', '0 15 * * *', $$
  select net.http_post(
    url := 'https://www.vendza.store/api/internal/cron/run?task=delivery-reminder',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_secrets where name='cron')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);   -- 10h : rappel aux vendeurs (commandes payées à livrer)

select cron.schedule('vendza-popular', '0 17 * * *', $$
  select net.http_post(
    url := 'https://www.vendza.store/api/internal/cron/run?task=popular',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_secrets where name='cron')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);   -- 12h : produit le plus commandé de la semaine

select cron.schedule('vendza-vendor-summary', '30 23 * * *', $$
  select net.http_post(
    url := 'https://www.vendza.store/api/internal/cron/run?task=vendor-summary',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_secrets where name='cron')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
$$);   -- 18h30 : résumé de la journée pour les vendeurs
