# Feature 03 — Fluxo Standard

## Resumo
Workflow para usuarios standard/free. Usa GPT-4.1-mini com as mesmas tools e capabilities do Premium. **Na pratica, NAO ha diferenca funcional entre Premium e Standard.**

## Arquitetura
Identica ao Premium (Feature 02). Mesmo modelo, mesmas tools, mesma memoria Redis.

## Diferenca Esperada vs Real

| Aspecto | Esperado | Real |
|---------|----------|------|
| Modelo AI | Modelo mais simples | GPT-4.1-mini (mesmo) |
| Tools | Menos ferramentas | Todas as mesmas |
| Memoria | Sem ou mais curta | Redis 3600s (mesmo) |
| Funcionalidades | Limitadas | Identicas |

## BUG CRITICO: Sem Diferenciacao de Plano

Os workflows "User Premium" e "User Standard" sao **funcionalmente identicos**. Um usuario Standard/Free tem acesso as mesmas funcionalidades que um Premium via WhatsApp:
- Criar/editar/excluir gastos
- Criar/editar/excluir eventos
- Criar/editar/excluir limites
- Transcricao de audio
- OCR de imagens/PDFs
- Relatorios

**Impacto:** Usuarios podem usar todas features premium sem pagar, bastando interagir via WhatsApp em vez do frontend.

## Erros Conhecidos / Riscos

1. **CRITICO — Sem diferenciacao:** Standard tem mesmas capacidades que Premium via bot
2. **Billing bypass:** Features pagas no frontend sao gratuitas via WhatsApp
3. **Sem enforcement de plano nos webhooks:** Tools nao verificam plano do usuario
4. **Investimento em premium nao faz sentido:** Usuario pode obter tudo via WhatsApp gratis
