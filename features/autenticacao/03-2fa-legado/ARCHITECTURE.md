# Critica Arquitetural — 2FA Legado

## Problemas CRITICOS

### 1. Dupla implementacao de 2FA
Existem DUAS tabelas e DOIS fluxos de 2FA:
- `two_factor_sessions` (legado): email/IP em plain text
- `pending_2fa_sessions` (novo): email/IP hashed

Ambos coexistem sem clear deprecation path.

**Recomendacao URGENTE:** Migrar para `pending_2fa_sessions` exclusivamente. Dropar `two_factor_sessions` apos confirmar que nenhum code path a usa.

### 2. Email em plain text
Se banco for comprometido, emails da tabela `two_factor_sessions` estao expostos. A nova tabela usa hash — correto.

### 3. Sem migracao clara
Codigo frontend parece ter ambos os fluxos. Deveria haver feature flag ou remocao completa do legado.

## Recomendacao
Depreciar e remover completamente este fluxo apos confirmar que o OTP flow (Feature 01) cobre todos os casos.
