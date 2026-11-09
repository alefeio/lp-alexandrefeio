# Contrato de primeira conquista (ACT-1A)

Contrato de domínio para conduzir o comprador até a primeira conquista prática. Não altera checkout, preços, entitlements, CourseJourney nem a UI do `StudentDashboard` (isso fica para ACT-1B).

## Conceitos

| Conceito | Fonte operacional |
| --- | --- |
| Compra | `Order.status = PAID` (pagamento ou `zeroValueUpgrade`) |
| Acesso | `Entitlement.status = ACTIVE` (aulas FREE não exigem entitlement) |
| Aprendizado | `LessonProgress` (`startedAt`, `percent`, `completedAt`) |
| Conquista | Artefato verificável (`LessonResult`, `Diagnostic` COMPLETED, `LandingPageProject` / `LandingPagePublication`) |

Visualização, login, clique ou só leitura **não** contam como primeira conquista.

## Estados derivados

`payment_pending` → `access_pending` → `ready_to_start` → `in_progress` → `first_value_achieved` → `next_evolution` / `continuation` · `access_unavailable`

Não há máquina persistida. `selectFirstValueAction` deriva o estado dos fatos carregados.

## Regras de seleção (resumo)

1. Pedido `PENDING_PAYMENT` não libera pago.
2. `PAID` sem entitlement ACTIVE → `access_pending`.
3. Entitlement REVOKED → `access_unavailable`.
4. Atividade em andamento acessível da compra tem prioridade.
5. Senão, elegível do produto ainda sem conquista atribuída à compra.
6. Módulo/curso: menor `firstValueRank` (brief pago cedo), sem duplicar definições de aula.
7. Aula individual: nunca aponta outra aula paga não comprada.
8. Resultado anterior à compra → revisar/evoluir (`continuation`), sem atribuir à compra.
9. Sem artefato elegível → continuação pedagógica honesta (`fallback`).
10. Nunca inventa resultado.

Desempate entre compras: progresso em andamento → compra confirmada mais recente → `orderId`.

## Atribuição temporal

Usa `createdAt` / `updatedAt` do artefato vs `confirmedAt` da compra.

| Caso | Atribuição |
| --- | --- |
| `createdAt >= confirmedAt` | `after_purchase` |
| `createdAt < confirmedAt` e sem edit pós-compra | `before_purchase` |
| `createdAt < confirmedAt` e `updatedAt > confirmedAt` | `preexisting_edited` |
| Artefato de outro `userId` | `other_user` |

**Limitação:** não existe `firstAchievedAt` imutável. Edit de artefato antigo não prova conquista da compra nova.

## Matriz (24 aulas)

Ver `FIRST_VALUE_LESSON_CATALOG` em `src/lib/learning/first-value/catalog.ts`.

Destaques:

- Tráfego pago first-value pago preferencial: `objetivo-oferta-orcamento` (`CAMPAIGN_BRIEF_V1` → `LessonResult`+projeto).
- Sites first-value pago preferencial: `oferta-publico-acao-principal` (`CONVERSION_PAGE_BRIEF_V1` → `LandingPageProject`).
- `negocio-pronto-para-anunciar` e `leia-os-numeros`: `requires_dependency` (projeto/diagnóstico ou import de campanha).
- FREE com RESULT/tool persistido: `verified_artifact`, mas **não** substituem compra paga.

## Integração futura (ACT-1B)

`FirstValueRecommendation` é a saída consumível pelo dashboard. **Não** altera `paidOrderStart` nesta sprint: o CTA imediato pós-pagamento permanece; o contrato serve à ação contextual no `/app`.

## Migration

Não necessária.
