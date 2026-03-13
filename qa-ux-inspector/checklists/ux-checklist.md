# Checklist de Avaliacao UX

**Criterios de qualidade de experiencia do usuario para cada feature do Total Assistente**

## 1. Tempo de Resposta (Score 0-10)

| Score | Criterio |
|-------|----------|
| 10 | < 1 segundo |
| 8-9 | 1-2 segundos |
| 6-7 | 2-3 segundos |
| 4-5 | 3-5 segundos |
| 2-3 | 5-10 segundos |
| 0-1 | > 10 segundos ou timeout |

- [ ] Medir tempo entre envio do payload e recebimento da resposta
- [ ] Tempo aceitavel para o tipo de operacao?
- [ ] Resposta parcial/intermediaria enquanto processa (se longa)?
- [ ] Sem delay desnecessario entre etapas?

## 2. Clareza da Mensagem (Score 0-10)

| Score | Criterio |
|-------|----------|
| 10 | Mensagem perfeitamente clara, sem ambiguidade |
| 8-9 | Clara com detalhes menores que poderiam melhorar |
| 6-7 | Compreensivel mas requer alguma interpretacao |
| 4-5 | Parcialmente confusa ou com termos tecnicos |
| 2-3 | Dificil de entender sem contexto |
| 0-1 | Incompreensivel ou irrelevante |

- [ ] Mensagem responde diretamente ao que o usuario pediu?
- [ ] Linguagem simples e acessivel (sem jargao tecnico)?
- [ ] Informacoes organizadas logicamente?
- [ ] Confirmacao clara da acao realizada?
- [ ] Proximos passos claros (quando aplicavel)?

## 3. Tratamento de Erros (Score 0-10)

| Score | Criterio |
|-------|----------|
| 10 | Erro tratado graciosamente com sugestao de correcao |
| 8-9 | Erro explicado claramente com orientacao |
| 6-7 | Erro comunicado mas sem orientacao de correcao |
| 4-5 | Mensagem de erro generica |
| 2-3 | Erro tecnico exposto ao usuario |
| 0-1 | Sem tratamento (erro silencioso ou crash) |

- [ ] Erros sao comunicados de forma amigavel?
- [ ] Mensagem de erro explica O QUE deu errado?
- [ ] Mensagem de erro sugere COMO corrigir?
- [ ] Erros nao expoem stack traces ou dados internos?
- [ ] Sistema se recupera graciosamente apos erro?
- [ ] Rate limit comunicado de forma clara?

## 4. Formatacao (Score 0-10)

| Score | Criterio |
|-------|----------|
| 10 | Formatacao perfeita para WhatsApp |
| 8-9 | Bem formatada com detalhes menores |
| 6-7 | Legivel mas poderia ser mais organizada |
| 4-5 | Formatacao inconsistente |
| 2-3 | Dificil de ler, mal formatada |
| 0-1 | Formatacao quebrada ou ilegivel |

- [ ] Uso adequado de emojis (nao excessivo, relevante)?
- [ ] Quebras de linha bem posicionadas?
- [ ] Listas e itens bem organizados?
- [ ] Valores monetarios formatados corretamente (R$ X.XXX,XX)?
- [ ] Datas em formato brasileiro (DD/MM/YYYY)?
- [ ] Horarios em formato brasileiro (HH:MM ou HHh)?
- [ ] Negrito/italico usado adequadamente (*bold*, _italic_)?
- [ ] Mensagem nao e um "muro de texto" (tem espacamento)?
- [ ] Tamanho da mensagem adequado para WhatsApp (nao muito longa)?

## 5. Linguagem Natural (Score 0-10)

| Score | Criterio |
|-------|----------|
| 10 | Parece conversa humana natural em PT-BR |
| 8-9 | Natural com pequenas rigidezes |
| 6-7 | Compreensivel mas soa como bot |
| 4-5 | Mecanico, respostas padronizadas |
| 2-3 | Artificial, respostas desconexas |
| 0-1 | Incoerente ou em idioma errado |

- [ ] Resposta em portugues-BR correto (nao PT-PT)?
- [ ] Tom conversacional e amigavel?
- [ ] Sem erros gramaticais ou de ortografia?
- [ ] Uso de girias/expressoes brasileiras adequado?
- [ ] Sem respostas mecanicas repetitivas?
- [ ] Contexto da conversa mantido (se mensagem sequencial)?
- [ ] Personalizacao com nome do usuario (quando disponivel)?
- [ ] Sem "alucinacoes" da AI (informacoes inventadas)?

## 6. Completude da Resposta (Score 0-10)

| Score | Criterio |
|-------|----------|
| 10 | Resposta completa com todas as informacoes necessarias |
| 8-9 | Quase completa, falta detalhe menor |
| 6-7 | Informacoes principais presentes, faltam detalhes |
| 4-5 | Resposta parcial, informacoes importantes faltando |
| 2-3 | Resposta muito incompleta |
| 0-1 | Nao responde ao que foi pedido |

- [ ] Todas as informacoes solicitadas estao presentes?
- [ ] Confirmacao da acao realizada (criou evento, registrou despesa, etc)?
- [ ] Detalhes relevantes incluidos (data, hora, valor, local)?
- [ ] Nao ha informacoes redundantes ou irrelevantes?
- [ ] Se e uma consulta, todos os dados solicitados retornados?

---

## Calculo do UX Score Final

```
UX Score = (Tempo + Clareza + Erros + Formatacao + Linguagem + Completude) / 6
```

| UX Score | Classificacao |
|----------|--------------|
| 9-10 | Excelente |
| 7-8 | Bom |
| 5-6 | Aceitavel |
| 3-4 | Ruim |
| 0-2 | Critico |

---

## Criterios Adicionais por Tipo de Feature

### Features de Agenda
- [ ] Confirmacao inclui data, hora e titulo do evento?
- [ ] Conflito de horario detectado e comunicado?
- [ ] Fuso horario correto (America/Sao_Paulo)?

### Features Financeiras
- [ ] Valores com 2 casas decimais?
- [ ] Categorias de despesa/receita corretas?
- [ ] Totais calculados corretamente?
- [ ] Moeda em BRL (R$)?

### Features de Relatorios
- [ ] Periodo do relatorio claro?
- [ ] Dados agregados corretamente?
- [ ] Graficos/visualizacoes legíveis (se aplicavel)?
- [ ] Comparacoes com periodo anterior (se aplicavel)?
