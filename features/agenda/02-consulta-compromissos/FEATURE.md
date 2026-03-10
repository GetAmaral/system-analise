# Feature 02 — Consulta de Compromissos

## Resumo
Permite visualizar eventos na agenda do Total. Dois caminhos: frontend (FullCalendar + Supabase real-time) e WhatsApp/N8N (webhook com AI similarity matching).

## Fluxo de Dados

### Via Frontend
```
Calendar.tsx monta → useGoogleCalendar() → React Query fetch
  → Supabase SELECT * FROM calendar WHERE user_id = auth.uid() ORDER BY start_event ASC
  → Mapeamento para FullCalendar:
    - Nao-recorrentes: {id, title, start, end, backgroundColor}
    - Recorrentes: {id, title, rrule: "DTSTART:...\nRRULE:...", duration, exdate}
  → Filtros locais: searchTerm (nome+descricao), filterType (all/events/reminders)
  → Real-time listener: canal 'calendar-changes-{userId}', evento '*'
```

### Via WhatsApp/N8N
```
POST https://totalassistente.com.br/webhook/busca-total-evento (Basic Auth)
  Body: { nome_evento, descricao_evento, data_inicio_evento, data_fim_evento, user_id }

  1. Code4: Normaliza datas para UTC, constroi query PostgREST de overlap
  2. Supabase GetAll: calendar WHERE overlap(start_event, end_event) AND user_id
  3. AI Information Extractor (gpt-4.1-mini):
     - Compara CRITERIA vs RECORDS
     - Score 0-1.0 por evento (token intersection, substring, edit distance)
     - Threshold >= 0.90 para inclusao
     - Se sem criterios: retorna todos com score 1.0
  4. Response: array de { uuid, nome, descricao, inicio_evento, fim_evento, pontuacao, justificativa }
```

## Componentes Envolvidos

| Camada | Componente | Arquivo |
|--------|-----------|---------|
| Frontend | Calendar (page) | `src/pages/Calendar.tsx` |
| Frontend | DailyAgendaCard | `src/components/dashboard/DailyAgendaCard.tsx` |
| Hook | useGoogleCalendar (events query) | `src/hooks/useGoogleCalendar.ts` |
| N8N | Calendar WebHooks - FLOW B (SEARCH) | Workflow `ZZbMdcuCKx0fM712` |
| AI | gpt-4.1-mini (similarity matching) | N8N Information Extractor node |
| Database | calendar (SELECT) | 7 indexes |
| Real-time | Supabase Realtime | Canal per-user |

## Mapeamento FullCalendar

### Eventos nao-recorrentes
```javascript
{
  id: event.id,
  title: event.event_name,
  start: event.start_event,
  end: event.end_event,
  backgroundColor: event.reminder ? '#FF00FF' : 'hsl(var(--success))',
  extendedProps: { ...event }
}
```

### Eventos recorrentes (via rrulePlugin)
```javascript
{
  id: event.id,
  title: "circled-arrow " + event.event_name,  // prefixo visual
  rrule: "DTSTART:" + formatToICal(start) + "\nRRULE:" + stabilizeRRule(rrule),
  duration: calculateDuration(start, end),       // "HH:mm:ss"
  exdate: event.exdates?.map(formatToICal),
  backgroundColor: '#FF00FF'  // recorrentes sempre magenta
}
```

### Filtros locais
- **searchTerm:** filtra por `event_name` + `desc_event` (case-insensitive includes)
- **filterType:** 'all' | 'events' (reminder=false) | 'reminders' (reminder=true)

## AI Similarity Matching (N8N)

O workflow de busca usa GPT-4.1-mini para matching flexivel:
- **Prompt:** Recebe criterios (nome, descricao) e registros do banco
- **Scoring:** 0-1.0 baseado em token intersection, substring, edit distance
- **Cutoff:** >= 0.90
- **Sem criterios:** Retorna todos com score 1.0
- **Output:** Array com uuid, nome, descricao, datas (raw + pretty), pontuacao, justificativa

## Valores Hardcoded

| Valor | Local | Impacto |
|-------|-------|---------|
| Score threshold 0.90 | N8N Information Extractor | Pode perder matches parciais |
| Cores: #FF00FF (reminder), hsl(--success) (event) | Calendar.tsx | Nao configuravel |
| Search suggestions limit: 5 | Calendar.tsx | OK |
| Default timezone offset: -03:00 | N8N Code4 | Apenas BRT |

## Erros Conhecidos / Riscos

1. **Busca do frontend carrega TODOS eventos:** `SELECT *` sem paginacao. Com muitos eventos, performance degrada.
2. **AI matching adiciona latencia:** Cada busca via N8N gasta ~2-5s no GPT para scoring, alem do custo de API.
3. **Sem cache de busca:** Cada busca N8N refaz a query e o AI scoring do zero.
4. **Real-time pode causar flickering:** Se muitos eventos mudam rapidamente, o query invalidation causa re-renders frequentes.
5. **exdates comparacao por toDateString():** Perde informacao de hora — pode falhar em eventos recorrentes no mesmo dia em horarios diferentes.
