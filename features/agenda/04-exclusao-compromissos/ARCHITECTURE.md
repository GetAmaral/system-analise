# Critica Arquitetural — Exclusao de Compromissos

## Problemas

### 1. Sem soft delete
DELETE e irrecuperavel. Nao ha tabela de archive, audit log automatico, ou grace period.

**Recomendacao:** Usar `active = false` como soft delete com cleanup agendado.

### 2. Inconsistencia Google ↔ Supabase
Se o DELETE no Google falha (token expirado, evento ja removido), o Supabase delete ainda acontece. Resultado: evento some do Total mas persiste no Google.

**Recomendacao:** Tratar como operacao atomica ou implementar reconciliacao.

### 3. N8N limitado
O webhook de exclusao so aceita `event_id` direto. Nao ha AI matching como nos outros fluxos. E nao suporta exclusao de ocorrencia unica.

### 4. exdates sem hora
Problema ja citado: comparacao por `toDateString()` pode excluir ocorrencias erradas.

**Recomendacao:** Comparar por ISO datetime completo.

## Escalabilidade
| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Deletes em massa | Sem batch delete | 1 request por evento |
| exdates array | Sem limite | Array cresce indefinidamente em eventos de longa duracao |
