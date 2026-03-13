-- =============================================
-- CORRECAO BUG 2: Cron job usando service_role_key em vez de anon key
-- =============================================

-- 1. Remover cron antigo (pode ter nomes diferentes de tentativas anteriores)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname LIKE 'google-calendar-sync%';

-- 2. Criar novo cron com service_role_key do vault
SELECT cron.schedule(
  'google-calendar-sync-every-30m',
  '*/30 * * * *',
  $cron$
  SELECT extensions.http_post(
    url := 'https://ldbdtakddxznfridsarn.supabase.co/functions/v1/google-calendar-sync-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  )
  $cron$
);
