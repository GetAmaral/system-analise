# Critica Arquitetural — RBAC e Planos

## Problemas

### 1. plan_type como TEXT
Sem CHECK constraint ou enum. Strings inconsistentes ('premium', 'premium-mensal', 'Premium') precisam de normalizacao client-side.

**Recomendacao:** `CREATE TYPE plan_type AS ENUM ('free', 'standard', 'premium');` e normalizar no INSERT/UPDATE.

### 2. NULL = lifetime premium (perigoso)
Se `plan_end_date IS NULL`, usuario tem plano vitalicio. Um bug no webhook de pagamento que falhe em setar a data daria acesso permanente.

**Recomendacao:** `plan_end_date NOT NULL DEFAULT '2099-12-31'` para lifetimes, evitando ambiguidade.

### 3. RBAC sem frontend
Roles admin/moderator existem no banco mas nao ha painel admin no frontend. A infra esta pronta mas subutilizada.

**Recomendacao:** Implementar `/admin` com acesso restrito a has_role(uid, 'admin').

### 4. Logica duplicada
Verificacao de plano acontece em 3 lugares:
- RLS policies (SQL)
- SECURITY DEFINER functions (SQL)
- usePlanAccess() (TypeScript)

Se a logica mudar, precisa atualizar em todos os 3.

**Recomendacao:** Single source of truth: RPC `get_my_plan_data()` que retorna features disponiveis, frontend apenas consume.

### 5. 89+ SECURITY DEFINER functions
Cada funcao SECURITY DEFINER executa com privilegios elevados. Se qualquer uma tiver SQL injection ou bug logico, pode comprometer isolamento.

**Recomendacao:** Audit de cada funcao SECURITY DEFINER. Migrar para SECURITY INVOKER onde possivel.

## Escalabilidade

| Aspecto | Limite | Gargalo |
|---------|--------|---------|
| Roles | 3 (enum fixo) | Extensivel via ALTER TYPE |
| Planos | 3 (text livre) | Inconsistencia de dados |
| RLS policies | 100+ | Performance em queries complexas |
