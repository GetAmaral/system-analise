# Critica Arquitetural — VIP Calendar

## Problemas CRITICOS

### 1. Sem autenticacao — vulnerabilidade grave
O endpoint e publico. Qualquer request com um phone valido pode manipular conexoes Google. Nao ha token, nao ha verificacao de posse do telefone.

**Recomendacao URGENTE:** Adicionar token de sessao (ex: OTP via WhatsApp) ou restringir a chamadas do N8N com service_role key.

### 2. Duplicacao de arquitetura
`calendar_vip` e basicamente uma copia de `calendar` com `phone` em vez de `user_id`. Mesma coisa para `vip_google_connections` vs `google_calendar_connections`. Isso significa:
- Funcoes de lembrete precisam operar em DUAS tabelas
- Triggers sao duplicados
- Qualquer nova feature de calendario precisa ser implementada em DOIS lugares

**Recomendacao:** Unificar em tabela unica com `auth_type ENUM ('user', 'vip')` e `auth_identifier TEXT` (UUID ou phone).

### 3. OAuth state inseguro
O state e simplesmente o numero de telefone URL-encoded. Sem HMAC, sem nonce.

**Recomendacao:** State = HMAC(phone + timestamp + secret). Verificar no callback.

### 4. XSS em HTML rendering
Edge Functions que renderizam HTML fazem interpolacao direta de variaveis sem sanitizacao.

**Recomendacao:** Escape HTML entities antes de injetar.

### 5. Nao revoga tokens Google
O disconnect limpa tokens do banco mas nao chama `oauth2.googleapis.com/revoke`. O token Google continua valido.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| VIPs ativos | Sem limite (phone unique) | Query por phone |
| Seguranca | NENHUMA | Qualquer pessoa pode operar |
