# Contrato de primeira conquista (ACT-1A / ACT-1A.1 / ACT-1B.1)

Contrato de domínio para conduzir o comprador até a primeira conquista prática. Não altera checkout, preços, entitlements, CourseJourney nem a UI do `StudentDashboard` (wire do dashboard fica para ACT-1B.2).

## Fluxo de dados (ACT-1B.1)

```text
sessão autenticada (userId)
        │
        ▼
loadFirstValueRecommendation(userId)     ← somente leitura Prisma
        │
        ▼
FirstValueLoaderRecords                  ← fatos crus do usuário
        │
        ▼
buildFirstValueSelectInput(records)      ← normalização pura
        │
        ▼
selectFirstValueAction(input)            ← seletor puro (sem Prisma)
        │
        ▼
FirstValueRecommendation                 ← saída segura (sem payload privado)
```

Separação obrigatória: consulta → normalização → seleção. O seletor **não** conhece Prisma.

## Conceitos

| Conceito | Fonte operacional |
| --- | --- |
| Compra | `Order` + `OrderItem` + `OrderItemLesson` + `Payment` |
| Acesso | `Entitlement` (ACTIVE/REVOKED) + aula `PUBLISHED` |
| Aprendizado | `LessonProgress` |
| Conquista | Artefato pedagógico validado com `resultAchievedAt` comprovado |
| Preparação | `Project` ACTIVE / `LandingPageProject` / `CampaignDataImport` READY |

Visualização, login, clique, só leitura ou **criação vazia de `LandingPageProject`** **não** contam como primeira conquista.

## Pedidos com múltiplos itens

Cada `OrderItem` vira um `FirstValuePurchase` com:

- `orderId`
- `orderItemId` (desempate estável)
- `productType` do item
- `lessonSlugs` derivados de `OrderItemLesson` (snapshot da compra — não da composição atual do módulo/curso)
- confirmação financeira compartilhada do `Order`

Desempate: `confirmedAt|createdAt` desc → `orderId` → `orderItemId`.

## Status financeiro

Alinhado ao `OrderStatus` do Prisma: `PENDING_PAYMENT` · `PAID` · `CANCELLED` · `REFUNDED` · `NEEDS_REVIEW`.

| Status | Efeito |
| --- | --- |
| `PENDING_PAYMENT` | `payment_pending` |
| `PAID` + `confirmedAt` | elegível |
| `PAID` sem prova temporal | `confirmedAt = null` → `access_unavailable` |
| `NEEDS_REVIEW` | `access_unavailable` (conservador) |
| `CANCELLED` / `REFUNDED` | `access_unavailable` |

### Origem de `confirmedAt`

| Caso | Fonte |
| --- | --- |
| Pagamento aprovado | `Payment.approvedAt` com `Payment.status = APPROVED` e `Order.status = PAID` |
| Upgrade de valor zero | `Order.createdAt` se `zeroValueUpgrade`, `status = PAID` e `totalCents = 0` |

Nunca usar `Order.updatedAt`, revisão de pedido ou `NEEDS_REVIEW` como confirmação financeira.

## Evidência pedagógica

O loader monta `FirstValueArtifact` somente após validar payload/estrutura:

| Aula / caso | Prova | Timestamp |
| --- | --- | --- |
| Brief de Campanha | `LessonResult` + `campaignBriefSchema` + `projectId` | `LessonResult.createdAt` |
| Brief de Conversão | `LessonResult`/`LessonResponse` validado | `createdAt` da linha |
| Diagnóstico | `Diagnostic` COMPLETED | `completedAt` |
| Publicação LP | `LandingPagePublication` do usuário | `publishedAt` |
| Shell LP vazio | `landing_page_project_shell` | `resultAchievedAt = null` |

### Proibido

- Usar isoladamente `payload.completedAt` (mutável em re-saves, ex.: `saveConversionBriefForUser`)
- Tratar criação de `LandingPageProject` como conquista
- Incluir resultados de outro `userId`
- Enviar payload integral / oferta / orçamento na recomendação

Quando a data não puder ser comprovada → `resultAchievedAt = null` → atribuição `unknown`.

## Dependências

| Chave | Verdadeiro quando |
| --- | --- |
| `project` | existe `Project` ACTIVE do usuário |
| `landing_page_project` | existe `LandingPageProject` do usuário |
| `campaign_import` | existe `CampaignDataImport` do usuário com `status = READY` e não deletado |

Upload/falha/parcial ≠ pronto. Sem prova → comportamento conservador (CTA de preparação).

## Autorização

- `userId` vem da sessão validada (`loadFirstValueRecommendation(session.user.id)`).
- Todas as queries filtram por esse `userId`.
- Loader **não** cria/renova/restaura entitlements nem altera pedidos.

## Limitação temporal remanescente (sem migration)

Não existe `firstAchievedAt` imutável separado. A melhor prova atual é `LessonResult.createdAt` / `Diagnostic.completedAt` / `Publication.publishedAt`.

Edit de artefato antigo → `preexisting_edited`, nunca `after_purchase` falso.

Resolver “primeira conquista absoluta” com campo imutável exigiria migration — **fora do escopo** desta sprint.

## Integração futura (ACT-1B.2)

Conectar `loadFirstValueRecommendation` ao `StudentDashboard` **após auditoria**. Não altera `paidOrderStart`.

## Migration

Não necessária.
