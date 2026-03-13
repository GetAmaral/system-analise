import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://totalassistente.com.br',
  'https://www.totalassistente.com.br',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goog-channel-id, x-goog-resource-id, x-goog-resource-state',
  };
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    // Headers do webhook do Google
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceId = req.headers.get('x-goog-resource-id');
    const resourceState = req.headers.get('x-goog-resource-state');

    console.log('Webhook received:', { channelId, resourceId, resourceState });

    // Validar que e um webhook do Google
    if (!channelId || !resourceId) {
      console.error('Invalid webhook: missing headers');
      return new Response('Invalid webhook', { status: 400, headers: cors });
    }

    // sync = mudancas disponiveis
    if (resourceState === 'sync') {
      console.log('Webhook setup confirmed');
      return new Response('OK', { status: 200, headers: cors });
    }

    // exists = ha mudancas para sincronizar
    if (resourceState === 'exists') {
      console.log('Changes detected, triggering sync...');

      // Buscar usuario pelo webhook_id
      const { data: connection, error } = await supabase
        .from('google_calendar_connections')
        .select('user_id')
        .eq('webhook_id', channelId)
        .eq('webhook_resource_id', resourceId)
        .eq('is_connected', true)
        .single();

      if (error || !connection) {
        console.error('Connection not found for webhook:', error);
        return new Response('Connection not found', { status: 404, headers: cors });
      }

      // Dispara sincronizacao em background
      EdgeRuntime.waitUntil(
        performIncrementalSync(connection.user_id).catch(err => {
          console.error('Background sync error:', err);
        })
      );

      return new Response('OK', { status: 200, headers: cors });
    }

    return new Response('OK', { status: 200, headers: cors });

  } catch (error) {
    console.error('Webhook error:', error);
    // CORRECAO A8: nao vazar mensagem de erro interna
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});

async function performIncrementalSync(userId: string): Promise<void> {
  console.log(`Starting incremental sync for user: ${userId}`);

  try {
    // Buscar tokens e sync_token
    const { data: tokens, error: tokenError } = await supabase
      .rpc('secure_get_google_tokens', { p_user_id: userId })
      .single();

    if (tokenError || !tokens) {
      console.error('Failed to get tokens:', tokenError);
      return;
    }

    const accessToken = (tokens as any).access_token;
    const { data: connection } = await supabase
      .from('google_calendar_connections')
      .select('sync_token')
      .eq('user_id', userId)
      .single();

    let syncToken = connection?.sync_token;
    let nextPageToken: string | undefined = undefined;
    let newSyncToken: string | undefined = undefined;

    do {
      // Construir URL para sincronizacao incremental
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      if (nextPageToken) {
        url.searchParams.set('pageToken', nextPageToken);
      } else if (syncToken) {
        url.searchParams.set('syncToken', syncToken);
      } else {
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 30);
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + 90);
        url.searchParams.set('timeMin', timeMin.toISOString());
        url.searchParams.set('timeMax', timeMax.toISOString());
      }
      url.searchParams.set('maxResults', '250');
      url.searchParams.set('singleEvents', 'true');

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        if (response.status === 410) {
          console.log('Sync token expired, performing full sync...');
          await supabase
            .from('google_calendar_connections')
            .update({ sync_token: null })
            .eq('user_id', userId);
          return performIncrementalSync(userId);
        }
        throw new Error(`Google API error: ${response.status}`);
      }

      const data = await response.json();
      nextPageToken = data.nextPageToken;
      newSyncToken = data.nextSyncToken;
      const events = data.items || [];

      console.log(`Processing ${events.length} changed events`);

      for (const gEvent of events) {
        await processEventChange(userId, gEvent);
      }
    } while (nextPageToken);

    if (newSyncToken) {
      await supabase
        .from('google_calendar_connections')
        .update({
          sync_token: newSyncToken,
          last_sync_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    }

    console.log(`Incremental sync completed for user ${userId}`);

  } catch (error) {
    console.error('Incremental sync error:', error);
  }
}

async function processEventChange(userId: string, gEvent: any): Promise<void> {
  try {
    const googleEventId = gEvent.id;

    if (gEvent.status === 'cancelled') {
      await supabase
        .from('calendar')
        .delete()
        .eq('user_id', userId)
        .eq('session_event_id_google', googleEventId);
      return;
    }

    if (!gEvent.start?.dateTime || !gEvent.end?.dateTime) {
      return;
    }

    const { data: existing } = await supabase
      .from('calendar')
      .select('id, event_name, start_event, end_event, desc_event')
      .eq('user_id', userId)
      .eq('session_event_id_google', googleEventId)
      .maybeSingle();

    const eventData = {
      event_name: (gEvent.summary || 'Sem titulo').substring(0, 255),
      desc_event: (gEvent.description || '').substring(0, 5000),
      start_event: gEvent.start.dateTime || gEvent.start.date,
      end_event: gEvent.end.dateTime || gEvent.end.date,
      timezone: gEvent.start.timeZone || 'America/Sao_Paulo',
      calendar_email_created: gEvent.creator?.email || null,
    };

    if (existing) {
      const hasChanged =
        existing.event_name !== eventData.event_name ||
        existing.start_event !== eventData.start_event ||
        existing.end_event !== eventData.end_event ||
        (existing.desc_event || '') !== eventData.desc_event;

      if (hasChanged) {
        await supabase
          .from('calendar')
          .update(eventData)
          .eq('id', existing.id);
      }
    } else {
      await supabase
        .from('calendar')
        .insert({
          user_id: userId,
          session_event_id_google: googleEventId,
          reminder: false,
          remembered: false,
          active: true,
          ...eventData,
        });
    }

  } catch (error) {
    console.error(`Error processing event ${gEvent.id}:`, error);
  }
}
