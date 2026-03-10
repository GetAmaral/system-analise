# Feature 07 — Agenda Diaria Automatica (Premium)

## Resumo
Todo dia as 7h da manha, o sistema envia via WhatsApp a lista de eventos do dia para usuarios premium ativos. Funciona via Schedule Trigger no workflow Main.

## Fluxo

```
N8N: Main - Total Assistente
  Schedule Trigger: 7:00 AM diario

  1. Supabase GetAll: subscriptions WHERE
     status IN ('active','paid') AND
     current_plan IN ('premium','premium-mensal','premium-anual') AND
     end_date >= now() - 7 days

  2. Loop por usuario:
     a. Fetch profiles (phone, name)
     b. Fetch calendar WHERE user_id AND start_event >= today 00:00 AND start_event < tomorrow 00:00
     c. Monta texto com lista de eventos:
        "Bom dia, <nome>! Sua agenda para hoje:
         - 09:00 Reuniao de equipe
         - 14:00 Dentista
         - 18:00 Academia"
     d. Envia via WhatsApp (template ou texto direto)

  3. Se usuario sem eventos: envia mensagem "Sua agenda esta livre hoje!"
```

## Componentes

| Camada | Componente | Local |
|--------|-----------|-------|
| N8N | Main - Total Assistente (schedule branch) | Schedule Trigger 7AM |
| Database | subscriptions (filtro plano) | SELECT com status check |
| Database | calendar (eventos do dia) | SELECT com range de data |
| Database | profiles (nome, telefone) | SELECT |
| WhatsApp | Graph API ou template | Envio da mensagem |

## Filtros

### Usuarios elegíveis
```sql
SELECT * FROM subscriptions
WHERE status IN ('active', 'paid')
  AND current_plan LIKE 'premium%'
  AND end_date >= now() - interval '7 days';  -- grace period
```

### Eventos do dia
```sql
SELECT * FROM calendar
WHERE user_id = <uid>
  AND start_event >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
  AND start_event < date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day'
ORDER BY start_event ASC;
```

## Valores Hardcoded

| Valor | Local | Impacto |
|-------|-------|---------|
| 7:00 AM | Schedule Trigger | Nao configuravel |
| Timezone BRT | Calculo de "hoje" | Apenas Brasil |
| Grace period 7 dias | Query subscriptions | Inclui expirados recentes |
| WhatsApp Phone ID | Envio | Hardcoded |

## Erros Conhecidos / Riscos

1. **Horario fixo 7h:** Nao respeita preferencia do usuario. Para usuarios em fusos diferentes (ex: PT), 7h BRT pode ser inconveniente.
2. **Grace period inclui expirados:** Usuarios com plano vencido ha < 7 dias ainda recebem. Pode ser intencional (gentileza) ou bug.
3. **Sem opt-out:** Usuario nao pode desativar o envio diario.
4. **Sem retry:** Se WhatsApp falha as 7h, nao ha re-tentativa.
5. **Eventos recorrentes nao expandidos:** O query pega apenas eventos com start_event no dia. Eventos recorrentes cujo master e em outra data NAO aparecem na agenda diaria.
