# Critica Arquitetural — Lembretes Recorrentes

## Pontos Positivos
- RRULE support completo (DAILY, WEEKLY com BYDAY, MONTHLY com BYMONTHDAY/BYSETPOS, YEARLY)
- Trigger centralizado para due_at
- Procedure SQL para reset de recorrentes (eficiente, nao depende de N8N)
- Redis cache para contexto de mensagem

## Problemas

### 1. Polling de 50s com janela de 1 min
A combinacao de poll de 50s + filtro de +-1 min cria uma janela onde um lembrete pode ser processado 0, 1 ou 2 vezes. Se o N8N estiver sobrecarregado e pular uma execucao, o lembrete e perdido.

**Recomendacao:** Usar janela baseada em `last_checked_at` em vez de tempo fixo. Ou migrar para sistema event-driven (pg_notify + listener).

### 2. Full table scan a cada 50s
O query filtra por `reminder=TRUE AND remembered=FALSE AND due_at BETWEEN`. Com indice em `due_at` (existe: idx_calendar_due_at WHERE NOT NULL), a performance e OK para ate ~10k eventos. Mas sem particao ou archival, a tabela cresce indefinidamente.

### 3. Nao ha fila de retry
Se o WhatsApp API falha (rate limit, indisponibilidade), a notificacao e perdida. O `remembered` ja foi setado como TRUE.

**Recomendacao:** Setar `remembered=TRUE` APOS envio confirmado, nao antes.

### 4. Duracao fixa de 15 min para recorrentes
Lembretes recorrentes criados via N8N tem end = start + 15min. O usuario nao pode definir duracao.

### 5. Duas tabelas de calendario (calendar + calendar_vip)
A procedure `reset_recurring_reminders` opera em ambas, mas com logica duplicada. Qualquer mudanca precisa ser refletida em dois blocos de codigo.

**Recomendacao:** Unificar em tabela unica com coluna `auth_type` (user_id vs phone).

### 6. Redis como cache, nao como fila
Redis armazena o texto da mensagem por telefone (TTL 1h), mas nao e usado como fila de mensagens. Se o envio falha, o Redis nao ajuda a re-enviar.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Lembretes ativos | ~5k antes de lag no poll | Supabase query + loop |
| WhatsApp sends | 250/dia (business tier) | Meta rate limits |
| RRULE parsing SQL | ~10ms por evento | OK |
| Reset procedure | ~1s para 1000 eventos | OK |
