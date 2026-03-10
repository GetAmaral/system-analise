# Critica Arquitetural — Modificacao de Compromissos

## Problemas

### 1. PUT vs PATCH inconsistencia
Edge Function usa PUT (sobrescreve evento inteiro no Google), N8N usa PATCH (parcial). Se o frontend enviar apenas start/end (drag), o PUT pode limpar description e outras props no Google.

**Recomendacao:** Unificar em PATCH para ambos.

### 2. Sem optimistic locking
Nao ha versionamento (ETag, updated_at check) nos updates. Em cenarios multi-dispositivo, edits podem se sobrescrever.

**Recomendacao:** Adicionar `WHERE updated_at = <expected_timestamp>` ou ETag.

### 3. Drag/resize de recorrentes modifica o master
Quando o usuario arrasta uma ocorrencia de evento recorrente, o `updateEvent` modifica o registro master (start_event, end_event). Isso afeta TODAS as ocorrencias, nao so a arrastada.

**Recomendacao:** Para recorrentes, criar excecao (exdate + novo evento) em vez de modificar o master.

### 4. AI matching duplica custo
O N8N faz AI matching para encontrar o evento (mesmo custo da busca) antes de editar. Para edicoes por ID direto, o AI e desnecessario.

**Recomendacao:** Aceitar event_id direto no webhook como atalho.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Edits simultaneos | Sem limit | Last-write-wins sem deteccao |
| Drag & Drop | Funcional | Recorrentes: comportamento inesperado |
| Google sync | 1 PUT por edit | Google quota (500 req/100s) |
