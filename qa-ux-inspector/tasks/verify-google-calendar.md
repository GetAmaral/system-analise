---
task: Verificar Google Calendar
responsavel: "@inspector"
responsavel_type: agent
atomic_layer: task
elicit: false
Entrada: |
  - user_id: string (required) - ID do usuario de teste
  - event_summary: string (optional) - Titulo do evento esperado
  - date_range: string (optional) - Periodo para busca (default: hoje)
  - feature_id: string (optional) - Feature que gerou o evento
Saida: |
  - calendar_state: object - Estado do calendario encontrado
  - event_found: boolean - Se o evento esperado foi encontrado
  - event_details: object - Detalhes do evento (se encontrado)
  - discrepancies: array - Divergencias entre esperado e encontrado
  - evidence: string - Evidencia documentada
Checklist:
  - "[ ] Identificar usuario de teste e evento esperado"
  - "[ ] Verificar estado do evento no Supabase (calendar_events)"
  - "[ ] Verificar sync status via logs do N8N (webhook Calendar)"
  - "[ ] Comparar dados no Supabase vs Google Calendar expected state"
  - "[ ] Documentar evidencias do estado encontrado"
  - "[ ] Retornar resultado para o caller"
---

# *verify-gcal {user}

Verifica o estado do Google Calendar apos um teste de feature de agenda, validando se o evento foi criado/modificado/deletado corretamente.

## Uso

```
@inspector

*verify-gcal TEST_user_123
# -> Verifica eventos recentes do usuario de teste no Google Calendar

*verify-gcal TEST_user_123 --event "TEST_Reuniao de equipe"
# -> Busca evento especifico
```

## Estrategia de Verificacao

Como o Inspector nao tem acesso direto a API do Google Calendar, a verificacao e feita indiretamente:

```
1. VERIFICACAO VIA SUPABASE
   ├── SELECT em calendar_events para o user_id
   ├── Verificar campos: google_event_id, sync_status, last_synced
   ├── Confirmar que evento existe no banco
   └── Verificar se sync_status = "synced"

2. VERIFICACAO VIA LOGS N8N
   ├── SSH: docker logs totalassistente-n8n --tail 100 (filtrar por calendar)
   ├── Verificar se webhook de Calendar processou o evento
   ├── Verificar se houve erro de sync com Google
   └── Confirmar response da Google Calendar API nos logs

3. VERIFICACAO VIA WEBHOOK CALENDAR
   ├── Verificar logs do workflow "Calendar WebHooks - Total Assistente"
   ├── Confirmar que o evento foi enviado ao Google
   └── Verificar response code da API Google (200/201 = sucesso)

4. COMPARACAO
   ├── Dados no Supabase vs dados esperados
   ├── Status de sync (synced/pending/error)
   ├── Timestamps de criacao e ultima sync
   └── Classificar: SYNCED / PENDING / ERROR / NOT_FOUND
```

## Campos Verificados

| Campo | Descricao | Esperado |
|-------|-----------|----------|
| `google_event_id` | ID do evento no Google | Nao nulo se synced |
| `sync_status` | Status da sincronizacao | "synced" |
| `summary` | Titulo do evento | Corresponder ao input |
| `start_time` | Hora de inicio | Corresponder ao input |
| `end_time` | Hora de fim | Corresponder ao input |
| `last_synced` | Ultima sincronizacao | Recente (< 5 min) |

## Metadata

```yaml
version: 1.0.0
dependencies:
  - Supabase anon key (para calendar_events)
  - SSH read-only (para docker logs)
tags:
  - verify
  - google-calendar
  - sync
  - agenda
```
