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

## Evidência pedagógica (ACT-1B.1.1)

Validação **por `toolKey`** com schemas reais. JSON genérico / incompleto **não** conta.

| Caso | Prova verificável | Timestamp confiável |
| --- | --- | --- |
| Brief Campanha | `campaignBriefSchema` + `projectId` | `createdAt` se `updatedAt === createdAt` |
| Brief Conversão | `conversionBriefResponseSchema` **ou** personal com oferta/público/ação | idem |
| Planos tráfego | schemas de destination/search/keyword/ads/meta/leads/diagnosis/next-action | idem |
| Wireframe / copy / visual / trust / experience / measurement | schemas de lesson-flow correspondentes | idem |
| FREE Sites | journey/presence/readiness schemas | idem |
| FREE RESULT (sem tool) | `resultResponseSchema` | idem |
| Diagnóstico aula | `LessonResponse` `toolResponseSchema` **+** Diagnostic COMPLETED vinculado | `Diagnostic.completedAt` |
| Publicação aula | `publicationLessonResponseSchema` **+** publication/LP do curso Sites | `publishedAt` |
| Shell LP | `landing_page_project_shell` | sempre `null` |

### Fallback conservador

- Sem schema adequado → sem artefato verificável
- Diagnóstico COMPLETED sem vínculo da aula → ignorado
- Publicação sem lesson payload da aula → não atribui a `revisao-antes-do-trafego`
- `updatedAt > createdAt` → `resultAchievedAt = null` / `unknown` (pode ter nascido incompleto)

### Proibido

- `payload.completedAt` / `updatedAt` como prova de primeira conquista
- kind + `landingPageProjectId` sozinhos no brief Sites
- Qualquer objeto JSON não vazio como prova
- Expor `subjectUserId` / payloads em Analytics ou meta pública

Entrypoint UI: `loadFirstValueForAuthenticatedUser()` → `requireSession()`.

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
