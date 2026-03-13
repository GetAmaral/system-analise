-- =============================================
-- VERIFICAR STATUS DOS USERS
-- Roda depois de aplicar os fixes 01-05
-- =============================================

-- 1. Ver quais users tem token expirado e precisam reconectar
SELECT
  gcc.user_id,
  u.email,
  gcc.connected_email,
  gcc.expires_at,
  gcc.webhook_expiration,
  gcc.last_sync_at,
  CASE
    WHEN gcc.expires_at > NOW() THEN 'TOKEN VALIDO'
    ELSE 'TOKEN EXPIRADO - precisa testar refresh'
  END as status,
  CASE
    WHEN gcc.webhook_expiration IS NULL THEN 'SEM WEBHOOK'
    WHEN gcc.webhook_expiration < NOW() THEN 'WEBHOOK EXPIRADO'
    ELSE 'WEBHOOK ATIVO'
  END as webhook_status
FROM google_calendar_connections gcc
JOIN auth.users u ON u.id = gcc.user_id
WHERE gcc.is_connected = true
ORDER BY gcc.expires_at DESC;

-- 2. Verificar se o vault tem a service_role_key configurada
-- (necessario para o trigger e o cron)
SELECT
  name,
  CASE WHEN decrypted_secret IS NOT NULL THEN 'CONFIGURADO' ELSE 'FALTANDO' END as status
FROM vault.decrypted_secrets
WHERE name = 'service_role_key';

-- 3. Verificar se o cron job esta ativo
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'google-calendar%';

-- 4. Ultimas respostas do http_post (para ver se o trigger esta funcionando)
SELECT status_code, LEFT(content, 150) as response, created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
