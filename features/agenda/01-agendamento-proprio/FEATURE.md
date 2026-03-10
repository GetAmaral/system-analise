# Feature 01 — Agendamento Proprio (Criar Eventos)

## Resumo
Permite que usuarios premium/standard criem eventos na agenda do Total Assistente. Eventos sao salvos no Supabase e, se o usuario tem Google Calendar conectado, tambem sao criados no Google.

## Fluxo de Dados

### Via Frontend (site)
```
Usuario preenche form → CreateEventModal → useGoogleCalendar.createEvent()
  → Supabase INSERT calendar (optimistic update)
  → Se Google conectado: Edge Function google-calendar (action: create)
    → Google Calendar API POST /calendars/primary/events
  → Trigger tr_sync_calendar_to_google dispara (loop prevention: skips se session_event_id_google mudou)
  → Real-time listener invalida cache React Query
```

### Via WhatsApp/N8N
```
Usuario envia mensagem → Main workflow → User Premium/Standard
  → AI classifica intencao como "calendario"
  → POST https://totalassistente.com.br/webhook/5e0f5e77-aea5-4784-8a85-58e8eaf49c30
  → Calendar WebHooks workflow:
    1. Edit Fields: mapeia body (nome_evento, descricao_evento, data_inicio_evento, data_fim_evento, id_user)
    2. buscar_conexao_user: GET google_calendar_connections (encrypted_refresh_token)
    3. IF Google conectado:
       a. decrypt_token_json RPC (key: google_calendar_secret_key_2024)
       b. refresh access_token via Google OAuth2
       c. POST Google Calendar API /calendars/primary/events
       d. INSERT calendar (connect_google=TRUE, session_event_id_google=google_id)
    4. ELSE:
       INSERT calendar (connect_google=FALSE)
```

## Componentes Envolvidos

| Camada | Componente | Arquivo |
|--------|-----------|---------|
| Frontend | CreateEventModal | `src/components/CreateEventModal.tsx` |
| Hook | useGoogleCalendar.createEvent | `src/hooks/useGoogleCalendar.ts` |
| Validacao | calendarEventSchema (Zod) | `src/lib/validation.ts` |
| Edge Function | google-calendar (action: create) | `supabase/functions/google-calendar/index.ts` |
| N8N | Calendar WebHooks - FLOW A (CREATE) | Workflow `ZZbMdcuCKx0fM712` |
| Database | Tabela calendar | 7 indexes, RLS premium/standard-gated |
| Trigger | tr_sync_calendar_to_google | `sync_calendar_event_to_google()` |
| Trigger | capitalize_event_name | `capitalize_event_name()` (INITCAP) |
| Trigger | calendar_set_due_at | Calcula due_at baseado em reminder flag |

## Schema da Tabela `calendar`

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| id | UUID | gen_random_uuid() | PK |
| user_id | UUID NOT NULL | - | FK auth.users |
| event_name | TEXT | - | Nome (INITCAP via trigger) |
| desc_event | TEXT | - | Descricao |
| start_event | TIMESTAMPTZ | - | Inicio |
| end_event | TIMESTAMPTZ | - | Fim |
| due_at | TIMESTAMPTZ | - | Calculado por trigger (start ou start-30min) |
| reminder | BOOLEAN | false | Se e lembrete |
| remembered | BOOLEAN | false | Se ja foi notificado |
| is_recurring | BOOLEAN | false | Se tem recorrencia |
| rrule | TEXT | - | Regra RRULE |
| exdates | TEXT[] | - | Datas excluidas |
| repeats_until | TIMESTAMPTZ | - | Fim da recorrencia |
| next_fire_at | TIMESTAMPTZ | - | Proximo disparo |
| last_fired_at | TIMESTAMPTZ | - | Ultimo disparo |
| timezone | TEXT | 'America/Sao_Paulo' | Fuso |
| connect_google | BOOLEAN | false | Se veio do Google |
| session_event_id_google | TEXT | - | ID do evento no Google |
| calendar_email_created | TEXT | - | Email do Google Calendar |
| active | BOOLEAN | true | Ativo |
| created_at | TIMESTAMPTZ | now() | Criacao |

## Validacao (Zod Schema)

```typescript
calendarEventSchema = z.object({
  event_name: z.string().trim().min(1).max(200),
  desc_event: z.string().max(2000).optional().nullable(),
  start_event: z.string().datetime(),
  end_event: z.string().datetime(),
  reminder: z.boolean()
}).refine(end > start)
```

**NAO validados pelo Zod:** is_recurring, rrule, repeats_until, exdates (passados via `as any`).

## Valores Hardcoded

| Valor | Local | Risco |
|-------|-------|-------|
| `reminder: true` sempre | CreateEventModal | Todos eventos sao marcados como lembrete — sem toggle no UI |
| `remembered: false` sempre | CreateEventModal | OK |
| Duracao default 1h | CreateEventModal | OK |
| `'America/Sao_Paulo'` | useGoogleCalendar | Sem suporte a outros fusos |
| `google_calendar_secret_key_2024` | N8N Calendar WebHooks | Chave de criptografia hardcoded |
| `https://ldbdtakddxznfridsarn.supabase.co` | useGoogleCalendar.ts:301 | URL hardcoded no hook |

## RLS (Row Level Security)

```sql
-- SELECT
CREATE POLICY "Premium users can view own calendar events"
ON calendar FOR SELECT USING (
  auth.uid() = user_id AND (user_has_premium(auth.uid()) OR user_has_standard(auth.uid()))
);
-- INSERT/UPDATE/DELETE: mesma logica
```

**Implicacao:** Usuarios free nao podem criar/ver eventos. Verificacao e no banco, nao so no frontend.

## Erros Conhecidos / Riscos

1. **`reminder` sempre true:** O frontend nao oferece toggle — todos eventos criados pelo site sao lembretes. Somente eventos Google-synced podem ter `reminder: false`.
2. **RRULE nao validado:** Campos de recorrencia bypassam Zod. Um RRULE malformado pode causar erro no FullCalendar ou no scheduler.
3. **Race condition:** Optimistic update + real-time listener podem conflitar se o INSERT demora.
4. **Trigger sync bidirecional:** `sync_calendar_event_to_google` dispara em AFTER INSERT, mas o evento ja foi criado via Edge Function — loop prevention depende de `session_event_id_google` change detection.
5. **N8N nao valida datas:** O webhook aceita qualquer string como data, normalizacao e best-effort.
