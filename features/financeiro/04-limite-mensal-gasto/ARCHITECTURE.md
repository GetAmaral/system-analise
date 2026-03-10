# Critica Arquitetural — Limite Mensal de Gasto

## Problemas

### 1. Coluna em profiles
Mesmo problema das metas: value_limit esta na tabela profiles, sem historico, sem flexibilidade para limites por periodo.

### 2. Default sem onboarding
Valor default de R$ 1.000 e aplicado silenciosamente. Usuario pode nao saber que existe e nunca configurar.

**Recomendacao:** Onboarding wizard que pergunta o limite desejado.

### 3. Redundancia com limites por categoria
Este e um limite GLOBAL, os category_limits sao POR CATEGORIA. Ambos coexistem sem integracao — a soma dos limites por categoria pode ser diferente do limite global.

**Recomendacao:** Limites por categoria deveriam somar ate o limite global, com validacao cruzada.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Configuracao | 1 valor por usuario | Nao extensivel |
| Calculo | Client-side | Performance em datasets grandes |
