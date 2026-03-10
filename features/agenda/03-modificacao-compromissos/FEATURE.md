# Feature 03 — Modificacao de Compromissos

## Resumo
Permite editar eventos existentes na agenda. Dois caminhos: frontend (EditEventModal) e WhatsApp/N8N (webhook com AI matching para localizar o evento).

## Fluxo de Dados

### Via Frontend
```
Usuario clica evento → EditEventModal abre com dados pre-preenchidos
  → Altera campos desejados → Submit
  → useGoogleCalendar.updateEvent(id, updates)
    → Optimistic update (React Query setQueryData)
    → Supabase UPDATE calendar SET ... WHERE id = X AND user_id = auth.uid()
    → Se Google conectado E session_event_id_google existe:
      Edge Function google-calendar (action: update, eventId, event)
        → PUT Google Calendar API /calendars/primary/events/{eventId}
    → Trigger tr_sync_calendar_to_google dispara (com loop prevention)
```

### Via WhatsApp/N8N
```
POST https://totalassistente.com.br/webhook/editar-eventos (Basic Auth)
  Body: {
    nome_evento, descricao_evento, data_inicio_evento, data_fim_evento,  -- criterios de busca
    novo_nome_evento, novo_desc_evento, novo_inicio_evento, novo_fim_evento,  -- novos valores
    user_id
  }

  1. Normaliza datas → Supabase GetAll (overlap query)
  2. AI Information Extractor (gpt-4.1-mini): Score similarity >= 0.90
  3. Switch:
     - > 1 resultado: Ambiguidade, retorna lista para usuario escolher
     - = 1 resultado: Prossegue com edicao
     - < 1 resultado: Nao encontrado
  4. Merge campos novos (fallback para originais se novo = null)
  5. Supabase UPDATE calendar SET event_name, desc_event, start_event, end_event WHERE id
  6. Se Google conectado: decrypt → refresh → PATCH Google Calendar API
```

## Componentes Envolvidos

| Camada | Componente | Arquivo |
|--------|-----------|---------|
| Frontend | EditEventModal | `src/components/EditEventModal.tsx` |
| Hook | useGoogleCalendar.updateEvent | `src/hooks/useGoogleCalendar.ts` |
| Validacao | calendarEventSchema (Zod) | `src/lib/validation.ts` |
| Edge Function | google-calendar (action: update) | `supabase/functions/google-calendar/index.ts` |
| N8N | Calendar WebHooks - FLOW C (EDIT) | Workflow `ZZbMdcuCKx0fM712` |
| Trigger | tr_sync_calendar_to_google | Sync bidirecional |
| Trigger | capitalize_event_name | INITCAP |
| Trigger | calendar_set_due_at | Recalcula due_at |

## Interacoes especiais

### Drag & Drop / Resize (FullCalendar)
```
handleEventDrop / handleEventResize:
  → Calcula novo start/end a partir do delta
  → Chama updateEvent(id, { start_event, end_event })
  → Mesmo fluxo de update
```

### RRULE parsing reverso (EditEventModal)
Ao abrir para edicao, o modal detecta o tipo de recorrencia:
- Busca `FREQ=DAILY` → tipo "daily"
- Busca `FREQ=WEEKLY` → tipo "weekly"
- Busca `FREQ=MONTHLY` → tipo "monthly"
- Busca `FREQ=YEARLY` → tipo "yearly"

## Erros Conhecidos / Riscos

1. **N8N ambiguidade:** Se AI encontra > 1 match, o workflow retorna a lista mas nao tenta resolver. O usuario precisa reformular.
2. **PATCH vs PUT:** Frontend usa PUT (via Edge Function) que substitui o evento inteiro no Google. N8N usa PATCH que atualiza apenas campos enviados. Comportamento inconsistente.
3. **Sem undo:** Nao ha como desfazer uma edicao.
4. **Race condition:** Se dois usuarios (ou dispositivos) editam o mesmo evento simultaneamente, o ultimo a salvar vence (last-write-wins). Sem conflict detection.
5. **Drag & Drop em recorrentes:** Arrastar uma ocorrencia de evento recorrente muda o evento INTEIRO, nao so aquela ocorrencia. Pode ser confuso para o usuario.
