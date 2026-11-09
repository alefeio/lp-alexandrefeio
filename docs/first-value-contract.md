# Contrato de primeira conquista (ACT-1A / ACT-1A.1)

Contrato de domínio para conduzir o comprador até a primeira conquista prática. Não altera checkout, preços, entitlements, CourseJourney nem a UI do `StudentDashboard` (isso fica para ACT-1B).

## Conceitos

| Conceito | Fonte operacional |
| --- | --- |
| Compra | `Order.status = PAID` com `confirmedAt` comprovado |
| Acesso | `Entitlement.status = ACTIVE` (aulas FREE não exigem entitlement) + aula publicada |
| Aprendizado | `LessonProgress` (`startedAt`, `percent`, `completedAt`) |
| Conquista | Artefato pedagógico verificável com `resultAchievedAt` comprovado |

Visualização, login, clique, só leitura ou **criação vazia de `LandingPageProject`** **não** contam como primeira conquista.

## Status financeiro (`FirstValueOrderStatus`)

Alinhado ao `OrderStatus` do Prisma: `PENDING_PAYMENT` · `PAID` · `CANCELLED` · `REFUNDED` · `NEEDS_REVIEW`.

| Status | Efeito no seletor |
| --- | --- |
| `PENDING_PAYMENT` | `payment_pending` |
| `PAID` + `confirmedAt` | elegível a acesso/conquista |
| `NEEDS_REVIEW` | `access_unavailable` (conservador; não libera) |
| `CANCELLED` / `REFUNDED` | `access_unavailable` |

### Origem de `confirmedAt`

| Caso | Fonte |
| --- | --- |
| Pagamento aprovado | `Payment.approvedAt` quando `Payment.status = APPROVED` e `Order.status = PAID` |
| Upgrade de valor zero | `Order.createdAt` no create com `zeroValueUpgrade` e status `PAID` |

Nunca usar `Order.updatedAt`, revisão de pedido ou `NEEDS_REVIEW` como confirmação financeira.

## Evidência pedagógica

O loader ACT-1B deve montar `FirstValueArtifact` a partir de:

- `LessonResult` / `LessonResponse` da aula e do usuário (preferencial para Sites e Tráfego)
- `Diagnostic.completedAt` quando `COMPLETED`
- `LandingPagePublication.publishedAt` para publicação

Shell / draft vazio de LP → `kind: landing_page_project_shell` ou `landing_page_draft` com `resultAchievedAt: null` → atribuição `unknown` (nunca `after_purchase`).

Kinds verificáveis (com `resultAchievedAt`): `lesson_result_personal` · `lesson_result_project` · `diagnostic_completed` · `landing_page_published`.

## Estados derivados

`payment_pending` → `access_pending` → `ready_to_start` → `in_progress` → `first_value_achieved` → `next_evolution` / `continuation` · `access_unavailable`

Não há máquina persistida. `selectFirstValueAction` deriva o estado dos fatos carregados.

## Preparação (Gate 5)

`preparation.status`:

- `ready` — atividade pronta para iniciar
- `needs_project` — CTA cria projeto (`/app/projetos/novo`)
- `needs_landing_page_project` — CTA de preparação (não promete resultado imediato)
- `needs_campaign_import` — CTA importa dados
- `unprovable` — não permite comprovar conquista

## Regras de seleção (resumo)

1. Pedido `PENDING_PAYMENT` não libera pago.
2. `NEEDS_REVIEW` / não-PAID → `access_unavailable`.
3. `PAID` sem entitlement ACTIVE → `access_pending`.
4. Entitlement REVOKED (todas as pagas) → `access_unavailable`.
5. Entitlement/publicação verificados **por atividade**, inclusive em `first_value_achieved` / `next_evolution`.
6. Histórico de conquista pode ser reconhecido sem CTA para conteúdo pago inacessível.
7. Atividade em andamento acessível tem prioridade.
8. `pickOwnedArtifact` prioriza evidência `after_purchase` sobre `updatedAt` de registro antigo.
9. Sem `resultAchievedAt` → `unknown`, nunca conquista pós-compra.
10. Nunca inventa resultado.

## Atribuição temporal

Usa `resultAchievedAt` vs `confirmedAt`.

| Caso | Atribuição |
| --- | --- |
| `resultAchievedAt >= confirmedAt` | `after_purchase` |
| `resultAchievedAt < confirmedAt` e sem edit pós-compra | `before_purchase` |
| `resultAchievedAt < confirmedAt` e `updatedAt > confirmedAt` | `preexisting_edited` |
| Sem `resultAchievedAt` ou sem `confirmedAt` | `unknown` |
| Artefato de outro `userId` | `other_user` |

**Limitação:** não existe `firstAchievedAt` imutável separado do `LessonResult.createdAt` / payload. Edit de artefato antigo não prova conquista da compra nova.

## Matriz (24 aulas)

Ver `FIRST_VALUE_LESSON_CATALOG`. Sites pago (exceto publicação) usa autoridade `LessonResult`; publicação usa `LandingPagePublication.publishedAt`.

## Integração futura (ACT-1B)

`FirstValueRecommendation` (inclui `preparation` e `existingResult.resultAchievedAt`) é a saída consumível pelo dashboard. **Não** altera `paidOrderStart` nesta sprint.

## Migration

Não necessária.
