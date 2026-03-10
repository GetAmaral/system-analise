# Feature 04 — Exclusao de Compromissos

## Resumo
Permite remover eventos da agenda. Suporta exclusao total e exclusao de ocorrencia unica (para recorrentes via exdates). Dois caminhos: frontend e N8N.

## Fluxo de Dados

### Via Frontend — Evento simples
```
DeleteEventDialog → handleDeleteAll()
  → useGoogleCalendar.deleteEvent(event.id)
    → Optimistic update: remove do cache
    → Supabase DELETE FROM calendar WHERE id = X AND user_id = auth.uid()
    → Se Google conectado E session_event_id_google:
      Edge Function google-calendar (action: delete, eventId)
        → DELETE Google Calendar API /calendars/primary/events/{eventId}
```

### Via Frontend — Ocorrencia unica de recorrente
```
DeleteEventDialog → handleDeleteSingle()
  → Busca evento original em events (pelo id)
  → Append event.start_event ao array exdates
  → useGoogleCalendar.updateEvent(event.id, { exdates: [...existing, newExdate] })
  → FullCalendar exclui a ocorrencia pelo exdate match
```

### Via N8N
```
POST https://totalassistente.com.br/webhook/excluir-evento-total (Basic Auth)
  Body: { event_id, user_id }

  1. Get a row: calendar WHERE id = event_id AND user_id
  2. buscar_conexao_user: verifica Google connection
  3. Se Google conectado:
     a. Decrypt token → Refresh access → DELETE Google Calendar API
     b. DELETE calendar WHERE session_event_id_google AND id
  4. Else:
     DELETE calendar WHERE id
```

## Componentes

| Camada | Componente | Arquivo |
|--------|-----------|---------|
| Frontend | DeleteEventDialog | `src/components/DeleteEventDialog.tsx` |
| Hook | useGoogleCalendar.deleteEvent | `src/hooks/useGoogleCalendar.ts` |
| Edge Function | google-calendar (action: delete) | `supabase/functions/google-calendar/index.ts` |
| N8N | Calendar WebHooks - FLOW D (DELETE) | Workflow `ZZbMdcuCKx0fM712` |

## Comportamento para recorrentes

O usuario ve duas opcoes:
1. **"Excluir todas as ocorrencias"** → DELETE do registro inteiro
2. **"Excluir apenas esta ocorrencia"** → Append start_event ao exdates array

A exclusao de ocorrencia unica NAO deleta nada — ela UPDATE o registro adicionando a data ao exdates. O FullCalendar (via rrulePlugin) automaticamente pula as datas em exdates.

## Erros Conhecidos / Riscos

1. **exdates por toDateString():** A comparacao usa dia apenas. Se houver dois horarios no mesmo dia, ambos sao excluidos.
2. **N8N nao suporta exclusao de ocorrencia unica:** O webhook de delete so faz DELETE total. Exclusao de ocorrencia unica so existe no frontend.
3. **Sem soft delete:** O DELETE e permanente. Sem lixeira ou undo.
4. **Google delete pode falhar silenciosamente:** Se o token expirou ou o evento ja foi deletado no Google, o erro e logado mas o Supabase delete ainda acontece — inconsistencia.
