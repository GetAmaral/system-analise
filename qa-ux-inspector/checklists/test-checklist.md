# Checklist de Teste por Feature

**Procedimento padrao para testar cada feature do Total Assistente**

## Fase 1: Pre-Teste (Preparacao)

- [ ] Feature identificada no catalogo (data/features-catalog.yaml)
- [ ] Cenarios de teste carregados (data/test-scenarios.yaml)
- [ ] Comportamento esperado consultado (data/expected-behaviors.yaml)
- [ ] Webhook endpoint identificado (/webhook-test/ SOMENTE)
- [ ] Tabelas Supabase envolvidas identificadas
- [ ] CONFIRMAR: URL e /webhook-test/ (DEV) e NAO /webhook/ (PROD)
- [ ] CONFIRMAR: Payload usa dados ficticios com prefixo TEST_

## Fase 2: Happy Path

- [ ] Montar payload do cenario feliz (input valido e tipico)
- [ ] Enviar HTTP POST para webhook-test DEV
- [ ] Capturar response (status code, body, tempo de resposta)
- [ ] Resposta retornada com status 200?
- [ ] Conteudo da resposta faz sentido para o input?
- [ ] Tempo de resposta aceitavel (< 3 segundos)?
- [ ] Verificar dados no Supabase (SELECT) - foram criados/atualizados corretamente?
- [ ] Verificar Google Calendar (se aplicavel) - evento criado/atualizado?
- [ ] Resposta em portugues-BR correto?
- [ ] Formatacao adequada (emojis, quebras de linha, estrutura)?

## Fase 3: Edge Cases

- [ ] Input com acentos e caracteres especiais (e, a, c, etc)
- [ ] Input com datas no limite (hoje, amanha, fim de semana, feriado)
- [ ] Input com valores numericos extremos (0, negativo, muito alto)
- [ ] Input com texto muito longo (> 500 caracteres)
- [ ] Input com texto muito curto (1-2 palavras)
- [ ] Input ambiguo (pode ser interpretado de multiplas formas)
- [ ] Input com horarios em formatos diferentes (14h, 14:00, 2pm, duas da tarde)
- [ ] Input com datas em formatos diferentes (01/03, 1 de marco, amanha)
- [ ] Requests duplicados (mesmo payload enviado 2x seguidas)
- [ ] Request durante processamento de outro (concorrencia)

## Fase 4: Cenarios de Erro

- [ ] Input completamente invalido (texto aleatorio, gibberish)
- [ ] Input vazio ou somente espacos
- [ ] Campos obrigatorios faltando no payload
- [ ] Formato de data invalido
- [ ] Formato de valor monetario invalido
- [ ] Telefone em formato errado
- [ ] Feature nao disponivel para o tipo de plano (standard vs premium)
- [ ] Rate limit atingido (muitas mensagens rapidas)
- [ ] Resposta de erro e amigavel e clara?
- [ ] Erro nao expoe informacoes tecnicas ao usuario?

## Fase 5: Qualidade da Resposta

- [ ] Resposta responde exatamente ao que foi pedido?
- [ ] Resposta e completa (todas as informacoes relevantes)?
- [ ] Resposta nao contem informacoes erradas?
- [ ] Resposta nao contem alucinacoes da AI?
- [ ] Tom da resposta e adequado (amigavel, profissional)?
- [ ] Resposta nao e excessivamente longa ou curta?
- [ ] Se ha lista de itens, esta bem formatada?
- [ ] Se ha valores monetarios, estao formatados corretamente (R$ X.XXX,XX)?
- [ ] Se ha datas, estao em formato brasileiro (DD/MM/YYYY)?

## Fase 6: Integridade de Dados

- [ ] Dados criados no Supabase correspondem ao input?
- [ ] Nao ha dados duplicados no banco apos o teste?
- [ ] Campos obrigatorios estao preenchidos no banco?
- [ ] Tipos de dados corretos (string, number, date, etc)?
- [ ] Relacionamentos (foreign keys) corretos?
- [ ] Google Calendar sync status = "synced" (se aplicavel)?
- [ ] Timestamps de criacao/atualizacao corretos?
- [ ] Dados de teste identificaveis pelo prefixo TEST_?

## Fase 7: Documentacao do Resultado

- [ ] Status classificado: PASS / PARTIAL / FAIL / ERROR
- [ ] Todos os problemas documentados com evidencia
- [ ] Payloads de teste salvos
- [ ] Responses capturadas
- [ ] Queries de verificacao registradas
- [ ] UX score atribuido (0-10)
- [ ] Resultado salvo em output/test-results/
