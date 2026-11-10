# COM-2 — Admin pricing management

Gestão comercial de preços no Admin, em reais (pt-BR), com o banco como fonte de verdade. Esta sprint **não** altera valores em Production nem ativa o piloto C1.

## COM-2.2.2 — Isolamento editorial × comercial

`saveLesson` **não** inclui `priceCents` no update quando a aula permanece/passa a PAID. Só limpa preço ao mudar para FREE (se permitido). Gravação editorial usa `updateMany` com `updatedAt` esperado (CAS); timestamp ausente/inválido é rejeitado. Assim uma alteração em `/admin/precos` não é sobrescrita pelo editor pedagógico.

## COM-2.2 — Final pricing hardening

### Compare-and-swap (CAS)

`updateProductPriceWithDb` / `updateProductPrice`:

1. Exige ator `ADMIN` (`isAdminRole`) além do `requireAdmin` da server action.
2. Exige `expectedUpdatedAt` ISO canônico não vazio.
3. Compara o timestamp com o registro atual **antes** de decidir no-op ou escrita.
4. Escrita via `updateMany` filtrando `id` + `updatedAt` + `commerceStatus` (e `accessType: PAID` em aulas).
5. `count !== 1` → conflito; nenhuma alteração de preço.

### Preço inalterado

Se o valor solicitado é igual ao persistido **e** o timestamp casa, retorna `Preço já está atualizado.` sem tocar `updatedAt` / `updatedById`.  
Se o valor é igual mas o timestamp está desatualizado, retorna conflito (não ignora concorrência).

### Sincronização do formulário (`PricingDesk`)

Após `router.refresh()`, campos acompanham o preço publicado quando o input não está dirty.  
Edição em andamento é preservada; a UI sinaliza que o publicado mudou.  
Confirmações AVAILABLE antigas são invalidadas.  
Salvar desabilitado se o valor for inválido ou faltar confirmação.  
Falhas inesperadas da action não deixam o botão travado (`try/finally`).

### Autorização

Defesa em profundidade: server action (`requireAdmin`) + serviço (`isAdminRole` + `userId`).

### Testes e limites

- Unidade + store em memória com CAS fiel (`tests/helpers/pricing-cas-store.ts`).
- **Não** conectam ao banco de Production.
- Não há suíte live obrigatória de corrida de dois admins nesta sprint.

### Histórico comercial

Ainda **não** existe tabela de auditoria de alterações de preço (só `updatedAt` / `updatedById`). Sem migration.

### Production

Nenhuma alteração de preços reais, Mercado Pago, checkout, orders, entitlements ou política C1 nesta PR.

## COM-2.1 — Safety & preview hardening

### Placeholder monetário

`createLesson` / `saveLesson` **não** atribuem `100` centavos. PAID em rascunho fica com `priceCents = null` até definição em `/admin/precos`. Publicação/venda respeitam prontidão existente.

#### Identificar possíveis placeholders antigos (`priceCents = 100`)

```sql
SELECT id, slug, title, "priceCents", status, "commerceStatus", "updatedAt"
FROM lesson
WHERE "accessType" = 'PAID' AND "priceCents" = 100;
```

`100` pode ser preço legítimo (R$ 1,00). Revisar caso a caso.

### Parser BRL

Aceita `14,90`, `R$ 14,90`, `1.234,56`, `15`, `1.234`. Rejeita milhares malformados, `14.90`, negativos e fora do limite.

### Simulação

`projectPricingDesk` em `pricing-core.ts` (client-safe). Escrita em `pricing-write.ts` / `pricing.ts` (`server-only`).

## Responsabilidades

| Área | Papel |
| --- | --- |
| `/admin/cursos`, `/admin/modulos`, `/admin/aulas` | Conteúdo, publicação, abrir/fechar venda |
| `/admin/precos` | Preços comerciais em R$ |

## Confirmação AVAILABLE

Servidor exige `confirmAvailable` quando o produto está AVAILABLE e o valor muda.
