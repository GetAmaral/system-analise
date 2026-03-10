# Critica Arquitetural — Login OTP

## Pontos Fortes
- Rate limiting em duas camadas (IP + email)
- Token de sessao com 256 bits de entropia
- Hashing de IP e email antes do armazenamento
- Audit logging
- sessionStorage (nao localStorage) para tokens temporarios
- Max attempts por sessao (5)

## Problemas

### 1. Sem cleanup automatico de sessoes
`pending_2fa_sessions` acumula registros expirados. A funcao `cleanup_expired_2fa_sessions()` existe mas precisa ser chamada manualmente (cron).

**Recomendacao:** Trigger no INSERT que limpa registros com `expires_at < now()`. Ou pg_cron a cada 15 min.

### 2. Rate limit compartilhado por NAT
Usuarios atras do mesmo gateway corporativo/residencial compartilham IP. 10 tentativas pode ser atingido rapidamente.

**Recomendacao:** Combinar IP + fingerprint do device, ou aumentar threshold para IPs compartilhados.

### 3. Sem deteccao de login suspeito
Nenhuma verificacao de:
- Geolocalizacao do IP
- Device fingerprint
- Horario incomum
- Multiplos paises simultaneos

**Recomendacao:** Implementar progressivamente — pelo menos alerta por email em login de novo device.

### 4. Hardcoded PROJECT_URL
Dificulta staging/development environments.

**Recomendacao:** `Deno.env.get('PROJECT_URL') || 'https://totalassistente.com.br'`

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| OTP/hora | ~360 (rate limit) | Supabase email rate |
| Sessoes ativas | Sem limit | Cleanup manual |
| Rate limit entries | Cleanup 24h | Tabela pode crescer |
