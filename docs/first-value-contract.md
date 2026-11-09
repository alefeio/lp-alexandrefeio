# Contrato de primeira conquista (ACT-1A / ACT-1A.1 / ACT-1B.1 / ACT-1B.1.2)

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

## Evidência pedagógica (ACT-1B.1.1 / ACT-1B.1.2)

Validação **por `toolKey`** com schemas reais. JSON genérico / incompleto **não** conta.

| Caso | Prova verificável | Timestamp confiável |
| --- | --- | --- |
| Brief Campanha | `campaignBriefSchema` + `projectId` | `createdAt` se `updatedAt === createdAt` |
| Brief Conversão | `conversionBriefResponseSchema` **ou** personal com oferta/público/ação | idem |
| Planos tráfego | schemas de destination/search/keyword/ads/meta/leads/diagnosis/next-action | idem |
| Wireframe / copy / visual / trust / experience / measurement | schemas de lesson-flow correspondentes | idem |
| FREE Sites | journey/presence/readiness schemas | idem |
| FREE RESULT (sem tool) | todos os campos do bloco RESULT com texto não vazio (espelha `saveLessonResult`) | idem |
| Diagnóstico aula | `LessonResponse` link + `ownedCompletedDiagnostic` (owner, `projectId`, `DIAGNOSTIC_VERSION`, COMPLETED, projeto ACTIVE) | `Diagnostic.completedAt` |
| Publicação aula | `publicationLessonResponseSchema` **+** publication/LP do curso Sites | `publishedAt` |
| Shell LP | `landing_page_project_shell` | sempre `null` |

### RESULT sem ferramenta (ACT-1B.1.2)

`resultResponseSchema` (`z.record`) **não** basta: `{}` e `{abc:""}` passam no Zod. O loader exige as chaves do bloco RESULT publicado (consulta `LessonBlock` type RESULT; fallback de seed em `FIRST_VALUE_RESULT_FIELD_KEYS`) com valores trimados não vazios, alinhado a `saveLessonResult`.

### Diagnóstico (ACT-1B.1.2)

Alinhado a `ownedCompletedDiagnostic` / `summaryFor` em `tool.ts`:

- `diagnostic.userId` = sujeito
- `diagnostic.id` = `link.diagnosticId`
- `diagnostic.projectId` = `link.projectId`
- `status = COMPLETED` + `completedAt`
- `version = DIAGNOSTIC_VERSION` (`traffic-readiness-v1`)
- projeto do vínculo `ACTIVE` e do mesmo usuário
- evidência de vínculo na aula via `LessonResponse` + `toolResponseSchema`

### Fallback conservador

- Sem schema adequado / campos RESULT incompletos → sem artefato verificável
- Diagnóstico COMPLETED sem vínculo da aula, projeto incompatível, versão antiga ou projeto inativo → ignorado
- Publicação sem lesson payload da aula → não atribui a `revisao-antes-do-trafego`
- `updatedAt !== createdAt` → `resultAchievedAt = null` / `unknown` (pode ter nascido incompleto)

### Proibido

- `payload.completedAt` / `updatedAt` como prova de primeira conquista
- kind + `landingPageProjectId` sozinhos no brief Sites
- Qualquer objeto JSON não vazio / `resultResponseSchema` isolado como prova
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

### Regra `updatedAt === createdAt`

Em `LessonResult` / `LessonResponse`, o Prisma usa `@default(now())` + `@updatedAt`. No **create** inicial, ambos tendem a coincidir no mesmo `INSERT` — a igualdade é compatível com criação real e serve como proxy conservador de “registro nunca reescrito”.

Falsos negativos esperados:

- Qualquer re-save (`saveLessonResult`, upsert de tool, import que atualiza o mesmo row) incrementa `updatedAt` → `resultAchievedAt = null` / atribuição `unknown`, mesmo com payload ainda válido.
- Drift teórico de clock entre `@default(now())` e `@updatedAt` no create (raro) também cairia em `unknown`.

Não usar `updatedAt`, `payload.completedAt` nem outros timestamps mutáveis para inventar primeira conquista.

Edit de artefato antigo → `preexisting_edited` / `unknown`, nunca `after_purchase` falso.

Resolver “primeira conquista absoluta” com campo imutável exigiria migration — **fora do escopo** desta sprint.

## Integração dashboard (ACT-1B.2)

`/app` (após `requireSession`) carrega em paralelo:

1. `loadStudentDashboard(session.user.id, …)`
2. `loadFirstValueCardForDashboard(session.user.id)` → `loadFirstValueRecommendation` + `presentFirstValueRecommendation`

Erro operacional do first-value → card omitido; dashboard antigo permanece. Auth continua exigida (não engolida).

ViewModel de UI (`FirstValueCardViewModel`): título, orientação, resultado esperado, estado, CTA seguro, progresso, preparação. Sem `orderId` / `reason` / payloads / finanças / meta do loader.

Prioridade visual (ACT-1B.2.1 / ACT-1B.2.2):

- **Destaque (`highlight`)** só com atividade elegível/acessível: `ready_to_start`, `in_progress`, `first_value_achieved` comprovado, `next_evolution`.
- **`payment_pending` / `access_pending`**: informativos secundários (CTA de pedido ok; nunca primary nem sobrescrevem `LearningBlock`).
- **`continuation` / `access_unavailable`**: informativos; **não** removem `nextAction` legado.
- Se CTA do card em destaque coincide com `LearningBlock` → LearningBlock omitido.
- Se CTA **informativo** coincide com `nextAction` / `businessNextAction` / LearningBlock → preservar a ação útil como **primary** e omitir **somente o CTA** do card (mensagem contextual permanece).

Não altera `paidOrderStart`.

## Migration

Não necessária.
