# Critica Arquitetural — Limites por Categoria

## Problemas

### 1. Limite apenas informativo
O sistema NAO impede a criacao de gastos que ultrapassem o limite. O limite e apenas visual. Um insert via N8N (WhatsApp) ignora completamente os limites.

**Recomendacao:** Adicionar trigger ou RPC que verifica limites antes de INSERT na tabela `spent`, retornando warning ao caller.

### 2. Calculo no client
Busca TODAS transacoes do mes e calcula client-side. Para usuarios com muitas transacoes, isso transfere dados desnecessarios.

**Recomendacao:** Criar RPC `get_category_spending(user_id, month)` que retorna agregados server-side.

### 3. Sem historico de limites
Se o usuario altera o limite no meio do mes, o valor anterior e perdido. Nao ha como comparar comportamento mes-a-mes.

**Recomendacao:** Tabela `category_limits_history` ou snapshot mensal.

### 4. Upsert depende da constraint UNIQUE
Se a constraint falhar ou for removida por engano, o sistema criara duplicatas silenciosamente.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Categorias por usuario | 11 (hardcoded) | Nao extensivel |
| Calculo mensal | Client-side | Transfere todos registros |
