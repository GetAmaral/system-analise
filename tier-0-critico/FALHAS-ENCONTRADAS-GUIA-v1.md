# FALHAS ENCONTRADAS NO GUIA DE CORRECAO v1

**Data:** 2026-03-11
**Agente:** Sherlock (analisador)
**Metodo:** Grep em 8 workflows N8N, 13 edge functions, frontend src/, migrations SQL, config.toml

---

## FALHAS CRITICAS (quebram producao se nao corrigidas)

### F1 — Passo 5 nao menciona N8N (QUEBRA 2 workflows)

**Severidade:** CRITICA
**Onde:** Passo 5 — Rotacionar chave de criptografia

**Problema:** 5 nodes em 2 workflows N8N passam a chave `google_calendar_secret_key_2024` hardcoded no body da request para `/rest/v1/rpc/decrypt_token_json`. O guia v1 rotaciona a chave sem atualizar o N8N.

**Workflows afetados:**
| Workflow | Node | Linha no JSON |
|----------|------|---------------|
| Calendar WebHooks - Total Assistente | `descriptografar_token_prod` | 149 |
| Calendar WebHooks - Total Assistente | `descriptografar_token_prod1` | 992 |
| Calendar WebHooks - Total Assistente | `descriptografar_token_prod2` | 1528 |
| Lembretes Total Assistente | `descriptografar_token_prod` | 213 |
| Lembretes Total Assistente | `descriptografar_token_prod1` | 2087 |

**Consequencia:** Calendar sync e lembretes PARAM completamente.
**Correcao no v2:** Passo 5 agora inclui sub-passos 5.3, 5.7, 5.8, 5.9 para N8N.

---

### F2 — `decrypt_token_json` nao existe nas migrations

**Severidade:** CRITICA
**Onde:** Passo 5 — Atualizar funcoes SQL

**Problema:** O guia v1 instrui atualizar `encrypt_token` e `decrypt_token`, mas o N8N chama `decrypt_token_json` via RPC — uma funcao SEPARADA que foi dropada na migration `20250912182714` e nunca recriada formalmente. Se ela existe em producao, foi criada via SQL Editor.

O guia v1 nao cria/atualiza `decrypt_token_json`, entao mesmo apos a rotacao, o N8N nao teria a funcao correta.

**Correcao no v2:** Adicionado Bloco C no passo 5.4 que cria `decrypt_token_json` delegando para `decrypt_token`.

---

### F3 — Sequencia errada para N8N (corrida de condicao)

**Severidade:** CRITICA
**Onde:** Passo 5 — Ordem de execucao

**Problema:** O guia v1 nao menciona desativar workflows N8N antes de re-criptografar. Se o N8N dispara durante a re-criptografia (ex: webhook do Google chega), o workflow tenta descriptografar um token "novo" com a chave "antiga" → falha silenciosa ou erro.

**Correcao no v2:** Adicionado passo 5.3 (desativar workflows) e 5.8 (reativar).

---

## FALHAS ALTAS (podem causar problemas serios)

### F4 — Lista de funcoes CORS incompleta

**Severidade:** ALTA
**Onde:** Passo 1 — lista de arquivos para editar

**Problema:** O guia v1 lista 13 funcoes para editar CORS. Mas:
- **Falta `kiwify-webhook/index.ts`** — existe no config.toml com verify_jwt=false
- **Falta `unlink-phone/index.ts`** — chamada pelo frontend (PhoneManagement)
- Lista funcoes que serao DELETADAS nos passos seguintes (create-user-admin, sync-profile-to-auth, vip-google-connect) — esforco desnecessario

**Correcao no v2:** Lista atualizada, funcoes a deletar removidas, faltantes adicionadas.

---

### F5 — Template CORS unico nao cobre webhooks com headers extras

**Severidade:** ALTA
**Onde:** Passo 1 — template de CORS

**Problema:** O guia v1 fornece um unico template CORS generico com:
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

Mas:
- `hotmart-webhook` precisa de `x-hotmart-hottok`
- `google-calendar-webhook` precisa de `x-goog-channel-id, x-goog-resource-id, x-goog-resource-state`

Se o template generico for aplicado a essas funcoes, os headers extras sao perdidos. Isso pode causar problemas em preflight requests (OPTIONS).

**Correcao no v2:** 3 templates separados (padrao, hotmart, google webhook).

---

### F6 — Nao menciona URLs de desenvolvimento

**Severidade:** ALTA
**Onde:** Passo 1 — CORS

**Problema:** O guia v1 so lista `totalassistente.com.br` e `www.totalassistente.com.br` como origens permitidas. Mas:
- O frontend tem referencia a `https://ignorethissiteavtotal.lovable.app` (URL de preview Lovable)
- Desenvolvimento local usa `localhost:3000` ou similar

Se CORS for restrito sem incluir essas URLs, o desenvolvimento e preview param de funcionar.

**Correcao no v2:** Adicionado aviso e comentarios no template para incluir URLs de dev.

---

## FALHAS MEDIAS (podem causar confusao ou problemas menores)

### F7 — Passo 3 nao verifica hotmart-webhook como INSERT em profiles

**Severidade:** MEDIA
**Onde:** Passo 3 — Verificacao de dependencias

**Problema:** O guia v1 diz "verificar se algo depende com grep no frontend". Mas o INSERT em profiles vem do `hotmart-webhook` (edge function), nao do frontend. Alguem poderia pensar "nada depende" sem perceber que o trigger dispara no hotmart.

**Correcao no v2:** Adicionada nota explicando que hotmart-webhook faz INSERT mas nao depende do resultado do trigger.

---

### F8 — Re-criptografia pode dar timeout

**Severidade:** MEDIA
**Onde:** Passo 5 — Re-criptografar tokens

**Problema:** O guia v1 faz um unico UPDATE em toda a tabela. Se houver centenas/milhares de registros, a query pode dar timeout no Supabase (limite de 60s por query no free tier).

**Correcao no v2:** Adicionada opcao de batches de 100 registros.

---

### F9 — Passo 5 nao menciona `store_access_token`

**Severidade:** MEDIA
**Onde:** Passo 5 — Atualizar funcoes SQL

**Problema:** O guia v1 lista funcoes SQL que precisam ser atualizadas mas nao menciona `store_access_token`, usada pelo `google-calendar` edge function para atualizar tokens apos refresh.

**Correcao no v2:** Adicionada a lista de funcoes a verificar.

---

### F10 — Passo 6 nao testa N8N

**Severidade:** MEDIA
**Onde:** Passo 6 — Verificacao final

**Problema:** O checklist de verificacao so testa funcionalidades via frontend. Nao testa se os workflows N8N estao funcionando apos as mudancas.

**Correcao no v2:** Adicionado checklist 6.4 especifico para N8N.

---

### F11 — Nao verifica existencia de `decrypt_token_json` antes de usar

**Severidade:** MEDIA
**Onde:** Passo 5.6 — Verificacao

**Problema:** O guia v1 nao testa se `decrypt_token_json` funciona. So testa `decrypt_token`.

**Correcao no v2:** Adicionado teste especifico para `decrypt_token_json`.

---

### F12 — `kiwify-webhook` nao mencionado em nenhum lugar

**Severidade:** MEDIA
**Onde:** Todo o guia

**Problema:** O `config.toml` lista `kiwify-webhook` com `verify_jwt = false`. Esta funcao nao aparece no guia de vulnerabilidades nem no guia de correcao. Se e um webhook de pagamento (similar ao Hotmart), pode ter as mesmas vulnerabilidades.

**Correcao no v2:** Adicionado na lista CORS e mencionado nos proximos passos (TIER 1).

---

## RESUMO

| Severidade | Quantidade | Impacto |
|-----------|-----------|---------|
| CRITICA | 3 | Quebram producao (N8N para de funcionar) |
| ALTA | 3 | Podem causar problemas serios (CORS, dev) |
| MEDIA | 6 | Confusao, timeouts, testes incompletos |
| **Total** | **12** | |

Todas as 12 falhas foram corrigidas no `GUIA-DE-CORRECAO-v2.md`.

---

*— Sherlock, diagnosticando com precisao*
