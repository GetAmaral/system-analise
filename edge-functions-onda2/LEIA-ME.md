# ONDA 2 — Edge Functions Corrigidas + SQL

## COMO USAR

Copie o conteudo de cada arquivo `.ts` e cole no Supabase Dashboard > Edge Functions > [nome da funcao].

---

## EDGE FUNCTIONS (copiar e colar no Supabase)

| Arquivo | Funcao no Supabase | O que foi corrigido |
|---------|-------------------|---------------------|
| `hotmart-webhook.ts` | hotmart-webhook | A2: comparacao constant-time do HOTTOK. M2: logs sem dados pessoais (LGPD) |
| `create-user-admin.ts` | create-user-admin | A2: comparacao constant-time do ADMIN_API_SECRET. M9: senha minimo 8 chars. A8: erro generico |
| `unlink-phone.ts` | unlink-phone | A3: filtro `.eq("user_id", user.id)` — usuario so desvincula SEU telefone |
| `google-calendar-webhook.ts` | google-calendar-webhook | A8: erro generico em vez de vazar mensagem interna |
| `fetch-market-data.ts` | fetch-market-data | M3: validacao de ticker (anti-SSRF). A8: erro generico. B5: removido bloco legacy bugado |
| `google-calendar-sync-cron.ts` | google-calendar-sync-cron | A2: comparacao constant-time. A8: erro generico |

---

## SQL — Rodar no SQL Editor do Supabase

### SQL 1: Corrigir RLS de webhook_events_log (A4)

```sql
DROP POLICY IF EXISTS "Only service role can access webhook logs" ON public.webhook_events_log;
CREATE POLICY "Block public access to webhook logs" ON public.webhook_events_log
  FOR ALL TO public USING (false) WITH CHECK (false);
```

### SQL 2: Corrigir RLS de calendar_vip (A5)

```sql
DROP POLICY IF EXISTS "Service role full access on calendar_vip" ON public.calendar_vip;
CREATE POLICY "Block all public access to calendar_vip" ON public.calendar_vip
  FOR ALL TO public USING (false) WITH CHECK (false);
```

### SQL 3: Corrigir SECURITY DEFINER sem search_path (A6)

```sql
CREATE OR REPLACE FUNCTION public.sync_subscription_with_profile()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    plan_type = NEW.current_plan,
    plan_start_date = NEW.start_date,
    plan_end_date = NEW.end_date,
    updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_2fa_sessions()
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.two_factor_sessions
  WHERE expires_at < now() - interval '1 hour';
END;
$$;
```

### SQL 4: Remover trigger e funcao sync_profile_to_auth (A7)

> **NOTA:** So rode se ainda NAO fez isso no Passo 6 da Onda 1!

```sql
DROP TRIGGER IF EXISTS on_profile_created_sync_auth ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_profile_to_auth();
```

---

## VERIFICACAO

Depois de aplicar tudo, rode estas queries para confirmar:

```sql
-- A4: webhook_events_log deve retornar 0 rows com USING(true)
SELECT policyname, permissive, qual FROM pg_policies
WHERE tablename = 'webhook_events_log';

-- A5: calendar_vip deve retornar policy com USING(false)
SELECT policyname, permissive, qual FROM pg_policies
WHERE tablename = 'calendar_vip';

-- A6: Deve retornar search_path = public
SELECT proname, proconfig FROM pg_proc
WHERE proname IN ('sync_subscription_with_profile', 'cleanup_expired_2fa_sessions');

-- A7: Deve retornar 0 rows
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'on_profile_created_sync_auth';
```

---

## O QUE NAO MUDA

- `google-calendar/index.ts` — arquivo grande (~1000 linhas), nao foi alterado nesta onda
- `start-otp-login`, `verify-otp-secure`, `check-email-exists`, `delete-account` — ja corrigidos na Onda 1
- `create-checkout` — sem alteracoes necessarias nesta onda
