# Critica Arquitetural — Agendamento Proprio

## Pontos Positivos
- RLS no banco garante isolamento de dados mesmo se frontend for comprometido
- Optimistic updates melhoram UX percebida
- Trigger `capitalize_event_name` garante consistencia de formatacao
- Trigger `calendar_set_due_at` centraliza logica de calculo de lembrete

## Problemas Arquiteturais

### 1. Duplicidade de fluxo (Frontend vs N8N)
O mesmo evento pode ser criado por dois caminhos completamente diferentes:
- **Frontend:** Hook → Supabase INSERT + Edge Function
- **N8N:** Webhook → Google API + Supabase INSERT

Nao ha contrato compartilhado (schema, validacao). O N8N aceita campos diferentes (`nome_evento`) do frontend (`event_name`). Qualquer mudanca na tabela exige atualizacao em DOIS sistemas.

**Recomendacao:** Unificar criacao via Edge Function unica que ambos chamam.

### 2. Trigger `sync_calendar_event_to_google` e fragil
O trigger AFTER INSERT chama `extensions.http_post` para a Edge Function. Se a Edge Function estiver fora, o trigger falha silenciosamente (EXCEPTION handler com RAISE LOG). O usuario nao sabe que o Google nao foi atualizado.

**Recomendacao:** Fila de retry ou at-least-once delivery.

### 3. Timezone hardcoded
`'America/Sao_Paulo'` em 4 locais diferentes. Se o Total expandir para outros fusos (usuarios internacionais), cada um precisaria ser atualizado.

**Recomendacao:** Usar timezone do perfil do usuario (coluna `profiles.timezone`).

### 4. Validacao parcial
O Zod schema valida nome e datas, mas rrule, exdates, is_recurring passam sem validacao. Um payload malicioso via DevTools pode inserir dados inconsistentes.

**Recomendacao:** Adicionar campos de recorrencia ao schema Zod.

### 5. `reminder` hardcoded como true
O frontend nao permite criar eventos sem lembrete. Isso significa que o scheduler de lembretes (50s poll) processara TODOS eventos criados pelo site, gerando notificacoes mesmo quando o usuario nao quer.

**Recomendacao:** Adicionar toggle de lembrete no CreateEventModal.

### 6. Sem idempotencia no N8N
Se o webhook for chamado duas vezes com os mesmos dados, dois eventos identicos serao criados. Nao ha deduplicacao.

**Recomendacao:** Verificar duplicata antes do INSERT (por nome + data + user_id em janela de tempo).

## Escalabilidade

| Aspecto | Estado Atual | Limite estimado | Gargalo |
|---------|-------------|-----------------|---------|
| Eventos por usuario | Sem limite | ~10k antes de lag no FullCalendar | Frontend rendering |
| Polling de lembretes | 50s interval, full scan | ~5k eventos ativos com reminder=true | Query sem paginacao |
| Google sync | 1 request por evento | 500 req/100s (Google quota) | Rate limit Google |
| Real-time | 1 channel por usuario | ~500 conexoes simultaneas (Supabase tier) | Supabase Realtime |
