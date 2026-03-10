# Critica Arquitetural — Gestao de Conta

## Problemas CRITICOS

### 1. Edge functions admin sem autenticacao
`create-user-admin` e `sync-profile-to-auth` sao funcoes ADMIN que QUALQUER request pode chamar. Sao portas abertas para:
- Criacao de usuarios falsos
- Enumeracao de todos usuarios do sistema
- Denial of service via listUsers()

**Recomendacao URGENTE:**
```typescript
const authHeader = req.headers.get('Authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return new Response('Unauthorized', { status: 401 });
}
// Verificar se e service_role key ou JWT de admin
```

### 2. Email enumeration
check-email-exists retorna informacao demais. Deveria ser resposta uniforme.

**Recomendacao:** `{ exists: boolean }` apenas. Sem hasSubscription.

### 3. CORS wildcard
`Access-Control-Allow-Origin: *` em todas edge functions. Permite que qualquer site faca requests.

**Recomendacao:** Restringir a `https://totalassistente.com.br` e dominios de desenvolvimento.

### 4. Delete sem confirmacao forte
Conta deletada com um click. Sem re-autenticacao, sem cooldown.

**Recomendacao:** Exigir senha ou OTP antes de deletar. Soft-delete com 30 dias de recovery.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| sync-profile | Todos usuarios na memoria | OOM >10k users |
| check-email | Sem rate limit | Enumeration em massa |
| create-user-admin | Sem auth | Abuso ilimitado |
