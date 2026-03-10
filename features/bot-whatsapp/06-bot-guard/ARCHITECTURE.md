# Critica Arquitetural — Bot Guard

## Problemas

### 1. Valores hardcoded
Numero do bot fixo no workflow. Qualquer mudanca de numero requer editar o workflow manualmente.

**Recomendacao:** Variavel de ambiente ou lookup em tabela de configuracao.

### 2. Sem rate limiting real
Debounce previne duplicatas instantaneas mas nao limita volume. Usuario pode enviar 100 mensagens por hora.

**Recomendacao:** Implementar rate limit: max 30 mensagens/hora por usuario. Responder "Voce atingiu o limite" apos.

### 3. Sem blacklist/blocklist
Nao ha como bloquear numeros abusivos sem editar o workflow.

**Recomendacao:** Tabela `blocked_phones` verificada no guard.

### 4. Forward filter muito agressivo
Bloqueia TODOS audios encaminhados. Mas usuario pode querer encaminhar audio do proprio grupo.

**Recomendacao:** Bloquear apenas de numeros desconhecidos, nao do proprio usuario.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Debounce | Redis TTL | Configuravel |
| Rate limit | Inexistente | Abuso possivel |
| Blacklist | Inexistente | Manual no workflow |
