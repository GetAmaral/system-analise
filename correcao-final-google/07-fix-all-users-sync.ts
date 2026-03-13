import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Edge function temporaria para corrigir todos os users de uma vez
// Faz refresh de token + gera sync_token paginando todos os eventos
// Depois de usar, pode deletar essa function

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
  // Somente service_role_key pode chamar
  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${supabaseServiceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Buscar todos os users conectados
    const { data: connections, error } = await supabase
      .from('google_calendar_connections')
      .select('user_id, sync_token, expires_at')
      .eq('is_connected', true);

    if (error || !connections) {
      throw new Error(`Failed to fetch connections: ${error?.message}`);
    }

    const results: any[] = [];

    for (const conn of connections) {
      const userId = conn.user_id;
      console.log(`\n=== Processing user: ${userId} ===`);

      try {
        // 1. Pegar tokens decriptados
        const { data: tokens, error: tokenError } = await supabase
          .rpc('secure_get_google_tokens', { p_user_id: userId })
          .single();

        if (tokenError || !tokens) {
          results.push({ user_id: userId, status: 'ERROR', detail: 'Failed to get tokens' });
          continue;
        }

        let accessToken = (tokens as any).access_token;
        const refreshToken = (tokens as any).refresh_token;
        const expiresAt = (tokens as any).expires_at;

        // 2. Se token expirado, fazer refresh
        if (expiresAt && new Date() >= new Date(expiresAt)) {
          console.log(`Token expired for ${userId}, refreshing...`);

          if (!refreshToken) {
            results.push({ user_id: userId, status: 'NEEDS_RECONNECT', detail: 'No refresh token' });
            continue;
          }

          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }),
          });

          const refreshData = await refreshResponse.json();

          if (!refreshResponse.ok) {
            console.error(`Refresh failed for ${userId}: ${refreshData.error}`);
            results.push({ user_id: userId, status: 'NEEDS_RECONNECT', detail: `Refresh failed: ${refreshData.error}` });
            continue;
          }

          // Salvar novo access_token
          accessToken = refreshData.access_token;
          await supabase.rpc('store_access_token', {
            p_user_id: userId,
            p_token: accessToken,
            p_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
          });

          console.log(`Token refreshed for ${userId}`);
        }

        // 3. Se ja tem sync_token, testar se funciona
        if (conn.sync_token) {
          try {
            const testUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?syncToken=${encodeURIComponent(conn.sync_token)}&maxResults=1`;
            const testResp = await fetch(testUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (testResp.ok) {
              console.log(`Sync token valid for ${userId}`);
              results.push({ user_id: userId, status: 'OK', detail: 'Sync token already valid' });
              continue;
            }

            if (testResp.status === 410) {
              console.log(`Sync token expired for ${userId}, will regenerate`);
              // Clear and continue to regenerate
            } else {
              const errData = await testResp.json();
              console.error(`Sync test failed for ${userId}: ${testResp.status}`, errData);
              results.push({ user_id: userId, status: 'ERROR', detail: `Google API: ${testResp.status}` });
              continue;
            }
          } catch (e) {
            console.error(`Sync test error for ${userId}:`, e);
          }
        }

        // 4. Paginar todos os eventos para gerar sync_token
        console.log(`Generating sync token for ${userId}...`);

        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 30);
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + 180);

        let pageToken: string | undefined;
        let syncToken: string | undefined;
        let totalEvents = 0;
        let page = 0;

        do {
          page++;
          let url: string;
          if (pageToken) {
            url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=250&singleEvents=true&pageToken=${encodeURIComponent(pageToken)}`;
          } else {
            url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=250&singleEvents=true&timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}`;
          }

          const resp = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (!resp.ok) {
            const errData = await resp.json();
            console.error(`Page fetch failed for ${userId}: ${resp.status}`, errData);
            results.push({ user_id: userId, status: 'ERROR', detail: `Google API error on page ${page}: ${resp.status}` });
            break;
          }

          const data = await resp.json();
          const items = data.items || [];
          totalEvents += items.length;
          pageToken = data.nextPageToken;
          syncToken = data.nextSyncToken;

          console.log(`  Page ${page}: ${items.length} events (total: ${totalEvents})`);
        } while (pageToken);

        // 5. Salvar sync_token
        if (syncToken) {
          await supabase
            .from('google_calendar_connections')
            .update({
              sync_token: syncToken,
              last_sync_at: new Date().toISOString()
            })
            .eq('user_id', userId);

          console.log(`Sync token saved for ${userId} (${totalEvents} events)`);
          results.push({ user_id: userId, status: 'OK', detail: `Sync token generated (${totalEvents} events)` });
        } else if (!results.find(r => r.user_id === userId)) {
          results.push({ user_id: userId, status: 'ERROR', detail: 'No sync token obtained' });
        }

      } catch (err) {
        console.error(`Error processing ${userId}:`, err);
        results.push({ user_id: userId, status: 'ERROR', detail: (err as Error).message });
      }
    }

    // Resumo
    const ok = results.filter(r => r.status === 'OK').length;
    const needsReconnect = results.filter(r => r.status === 'NEEDS_RECONNECT').length;
    const errors = results.filter(r => r.status === 'ERROR').length;

    console.log(`\n=== SUMMARY ===`);
    console.log(`OK: ${ok}, Needs reconnect: ${needsReconnect}, Errors: ${errors}`);

    return new Response(JSON.stringify({
      summary: { ok, needs_reconnect: needsReconnect, errors },
      results
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
