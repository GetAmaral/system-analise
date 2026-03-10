# Critica Arquitetural — Agenda Diaria Automatica

## Problemas

### 1. Eventos recorrentes nao expandidos
O query `WHERE start_event >= today AND start_event < tomorrow` pega apenas o master event. Se o usuario tem um lembrete diario com start_event = segunda-feira passada, ele NAO aparece na agenda de hoje.

**Recomendacao:** Usar a funcao `next_occurrence()` ou expandir RRULE server-side.

### 2. Sem opt-out
Nao ha flag `receive_daily_agenda` no perfil do usuario.

**Recomendacao:** Adicionar coluna em `profiles` ou `recurrency_report`.

### 3. Sem personalizacao de horario
7h BRT fixo. Em fusos diferentes ou para quem acorda mais tarde, e inutil.

**Recomendacao:** Coluna `preferred_agenda_time` em `profiles`.

### 4. Acoplamento ao workflow Main
A agenda diaria vive dentro do workflow Main (que faz MUITAS outras coisas). Deveria ser um workflow separado para isolamento de falha.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Usuarios premium | ~1000 por batch | Loop sequencial no N8N |
| WhatsApp sends | 250/dia (business tier) | Meta rate limits |
| Tempo total | ~10 min para 500 usuarios | N8N processing |
