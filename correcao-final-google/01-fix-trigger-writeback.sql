-- =============================================
-- CORRECAO BUG 1: Trigger envia localEventId para a edge function
-- A edge function vai gravar o Google Event ID de volta na tabela calendar
-- =============================================

-- Recriar a funcao do trigger
CREATE OR REPLACE FUNCTION public.sync_calendar_event_to_google()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_is_connected BOOLEAN;
  v_edge_function_url TEXT;
  v_service_role_key TEXT;
  v_action TEXT;
  v_event_data JSONB;
  v_local_event_id UUID;
BEGIN
  -- 1. Check if user has an active Google Calendar connection
  SELECT is_connected INTO v_is_connected
  FROM public.google_calendar_connections
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
    AND is_connected = true;

  -- If not connected, do nothing
  IF NOT v_is_connected THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 2. Determine action and prepare data
  IF (TG_OP = 'INSERT') THEN
    -- If event already has a Google ID, it came FROM Google — don't sync back (loop prevention)
    IF NEW.session_event_id_google IS NOT NULL THEN
      RETURN NEW;
    END IF;
    v_action := 'create';
    v_local_event_id := NEW.id;
    v_event_data := jsonb_build_object(
      'summary', NEW.event_name,
      'description', COALESCE(NEW.desc_event, ''),
      'start', jsonb_build_object('dateTime', NEW.start_event, 'timeZone', COALESCE(NEW.timezone, 'America/Sao_Paulo')),
      'end', jsonb_build_object('dateTime', NEW.end_event, 'timeZone', COALESCE(NEW.timezone, 'America/Sao_Paulo'))
    );

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Loop prevention: skip if only session_event_id_google changed
    IF (OLD.session_event_id_google IS NULL AND NEW.session_event_id_google IS NOT NULL) THEN
      RETURN NEW;
    END IF;
    -- Skip if no meaningful field changed
    IF (OLD.event_name = NEW.event_name
        AND OLD.start_event = NEW.start_event
        AND OLD.end_event = NEW.end_event
        AND COALESCE(OLD.desc_event, '') = COALESCE(NEW.desc_event, '')) THEN
      RETURN NEW;
    END IF;

    v_local_event_id := NEW.id;

    -- If no Google ID, create; otherwise update
    IF NEW.session_event_id_google IS NULL THEN
      v_action := 'create';
    ELSE
      v_action := 'update';
    END IF;

    v_event_data := jsonb_build_object(
      'summary', NEW.event_name,
      'description', COALESCE(NEW.desc_event, ''),
      'start', jsonb_build_object('dateTime', NEW.start_event, 'timeZone', COALESCE(NEW.timezone, 'America/Sao_Paulo')),
      'end', jsonb_build_object('dateTime', NEW.end_event, 'timeZone', COALESCE(NEW.timezone, 'America/Sao_Paulo'))
    );

  ELSIF (TG_OP = 'DELETE') THEN
    -- If no Google ID, nothing to delete in Google
    IF OLD.session_event_id_google IS NULL THEN
      RETURN OLD;
    END IF;
    v_action := 'delete';
    v_local_event_id := OLD.id;
  END IF;

  -- 3. Get config
  v_edge_function_url := 'https://ldbdtakddxznfridsarn.supabase.co/functions/v1/google-calendar';

  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- 4. Call Edge Function (async, fire-and-forget)
  -- CORRECAO: agora envia localEventId para que a edge function
  -- possa gravar o Google Event ID de volta na tabela calendar
  PERFORM extensions.http_post(
    url := v_edge_function_url,
    body := jsonb_build_object(
      'action', v_action,
      'userId', COALESCE(NEW.user_id, OLD.user_id),
      'eventId', COALESCE(NEW.session_event_id_google, OLD.session_event_id_google),
      'event', v_event_data,
      'localEventId', v_local_event_id
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role_key, '')
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

-- Recriar o trigger
DROP TRIGGER IF EXISTS tr_sync_calendar_to_google ON public.calendar;
CREATE TRIGGER tr_sync_calendar_to_google
  AFTER INSERT OR UPDATE OR DELETE ON public.calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_calendar_event_to_google();
