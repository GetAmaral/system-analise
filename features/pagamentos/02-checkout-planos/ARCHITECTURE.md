# Critica Arquitetural — Checkout e Planos

## Problemas

### 1. URLs hardcoded
Offer codes e product IDs diretamente no codigo. Se a Hotmart mudar o produto, precisa editar e re-deploy.

**Recomendacao:** Tabela `checkout_config` com plan_type → url mapping. Editavel sem deploy.

### 2. Precos inconsistentes
Dois componentes exibem precos diferentes para o mesmo plano. Confunde o usuario e pode gerar reclamacoes.

**Recomendacao:** Constante unica `PRICING` importada por todos componentes.

### 3. Cancelamento inexistente
UI promete mas nao entrega. Deveria integrar com API Hotmart para cancelamento user-initiated.

### 4. Sem downgrade
Upgrade implementado, downgrade nao. Usuario premium nao pode reverter para standard.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Planos | 6 URLs fixas | Hardcoded |
| Precos | Desincronizados | Multiplos fontes |
