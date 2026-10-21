# ADR — Landing Page Builder V1

Status: **ACCEPTED — PHASE 1, PHASE 2 e PHASE 3 IMPLEMENTED**. Phases 4–10 ainda não implementadas.

Relacionado: [`docs/courses/sites-que-convertem.md`](../courses/sites-que-convertem.md)

## Context

O curso **Sites que Convertem para Pequenos Negócios** tinha a formação paga terminando em planejamento/blueprint. A nova promessa exige que o aluno termine com uma **landing page real**, construída na plataforma e publicável.

Restrições:

- Não executar HTML/JS/React/Next arbitrário gerado por usuário ou LLM.
- Separar draft mutável de snapshot publicado.
- Manter `LessonResult` pedagógico sem fragmentar a página em artefatos desconectados.
- Não misturar mídia pública da landing com store privada de campaign data.
- Release do curso permanece **suspenso** até o core do builder.

## Decision

1. Introduzir o conceito **`LandingPageProject`** como objeto central das aulas 4–12.
2. Construir páginas apenas via **component registry tipado** + schemas Zod (ou equivalente).
3. Usar **Guided Wireframe Engine** determinístico na V1 (IA opcional depois).
4. Assistência de copy via serviço **provider-agnostic** com salvaguardas factuais; nunca publicar texto gerado automaticamente.
5. Publicar via **snapshot imutável** (`LandingPagePublication`), servido em rota própria com **noindex** por padrão.
6. Custom domain, export de código e JS arbitrário ficam **DEFERRED**.

## Architecture

```
Aulas 1–3 (FREE)          Aulas 4–12 (PAID)
descobrir ─────────────►  LandingPageProject (draft)
                              │
                              ├─ sections[] (registry)
                              ├─ theme tokens
                              ├─ measurement config
                              └─ media refs
                                    │
                         publish ──► LandingPagePublication (snapshot)
                                    │
                         public ──► /p/[slug]  (noindex)
                         preview ► autenticado (draft)
```

Princípio: **renderer controlado** lê JSON tipado → componentes React internos. Zero `eval`, zero `dangerouslySetInnerHTML` de conteúdo gerado, zero script injection.

## Data model proposal

### LandingPageProject

| Campo | Notas |
| --- | --- |
| id | cuid |
| userId | owner |
| projectId | opcional → `Project` genérico |
| courseId | referência ao curso sites (contexto pedagógico) |
| slug | **canônico** para roteamento futuro `/p/[slug]` · unique |
| title | |
| status | `DRAFT` \| `READY_TO_PREVIEW` \| `PUBLISHED` \| `UNPUBLISHED` |
| draftDocument | JSON tipado com `schemaVersion` + `registryVersion` |
| draftRevision | optimistic concurrency (int, inicia em 1) |
| publishedPublicationId | ponteiro opcional para snapshot ativo |
| createdAt / updatedAt | |

Não substitui `Project`. Relação: **Project 0..1 → LandingPageProject N**.

**Slug lock (Phase 1):** enquanto `publicationCount == 0`, slug pode mudar. Após a primeira `LandingPagePublication`, mutação de slug é rejeitada (`LANDING_PAGE_SLUG_LOCKED_AFTER_PUBLICATION`). Sem redirects na V1.

### LandingPagePublication

| Campo | Notas |
| --- | --- |
| id | |
| landingPageProjectId | |
| version | inteiro monotônico · unique com projectId |
| snapshot | cópia congelada do draft no momento do publish |
| publishedAt | |
| publishedSlug | slug usado no snapshot (auditoria) · **não** é autoridade de roteamento |

Roteamento canônico usa `LandingPageProject.slug`. Editar draft **não** altera o snapshot ativo até nova publicação.

### LessonResult (compatibilidade)

Cada aula 4–12 pode gravar `LessonResult` com resumo/etapa (brief, wireframe hash, etc.).  
O estado canônico da página vive em `LandingPageProject.draftDocument`.

### Phase 1 consolidada

- `schemaVersion: 1` (`LANDING_PAGE_DOCUMENT_SCHEMA_VERSION`)
- `registryVersion: "LANDING_COMPONENT_REGISTRY_V1"`
- `draftRevision` + update atômico com `expectedRevision`
- Registry MVP tipado (Zod): HERO, BENEFITS, PROCESS, TRUST, FAQ, CTA, FORM, CONTACT, FOOTER
- Sem UI, preview, publish, mídia, form backend, IA
- Migration: `20261020180000_add_landing_page_builder_core` (aditiva)

## Component registry

Registry versionado (`LANDING_COMPONENT_REGISTRY_V1`).

Tipos planejados:

`HERO` · `PROBLEM` · `SOLUTION` · `BENEFITS` · `FEATURES` · `PROCESS` · `ABOUT` · `TRUST` · `TESTIMONIALS` · `PORTFOLIO` · `FAQ` · `CTA` · `FORM` · `CONTACT` · `IMAGE_TEXT` · `CUSTOM_TEXT` · `FOOTER`

### Section schema (conceitual)

```ts
{
  id: string;
  type: ComponentType;
  variant: string;
  order: number;
  enabled: boolean;
  content: Record<string, unknown>; // validado por schema do type
  settings: Record<string, unknown>;
}
```

Sem HTML cru. Content/settings validados por schema por tipo.

### MVP registry (mínimo viável sugerido)

`HERO` · `BENEFITS` · `PROCESS` · `TRUST` · `FAQ` · `CTA` · `FORM` · `CONTACT` · `FOOTER`

## Draft / publish model

| Estado projeto | Significado |
| --- | --- |
| DRAFT | em construção |
| READY_TO_PREVIEW | passa validações mínimas de preview |
| PUBLISHED | tem snapshot ativo |
| UNPUBLISHED | snapshot desativado; URL deixa de servir |

Fluxo: editar draft → preview autenticado → validações → confirmar → criar `LandingPagePublication` → apontar versão ativa.

## AI boundaries

### Arbitrary code execution

**NO** — proibido gerar/executar HTML, JS, React ou Next arbitrário.

### Wireframe engine

Dados Aulas 4–5 → regras determinísticas → estrutura inicial → usuário edita (add/remove/reorder/variant/purpose) → salva no draft.

IA pode sugerir estrutura alternativa no futuro; **não é dependência V1**.

### Copy assist

`generateCopySuggestion(input) → JSON tipado validado`

- Entrada: apenas fatos/contexto aprovados pelo aluno
- Saída: campos de copy (headline, etc.), nunca markup executável
- Fluxo: sugerir → revisar → aprovar/editar → gravar no draft
- Nunca publicar automaticamente texto gerado
- Logs: version/prompt/provider operacional; **sem** conteúdo estratégico sensível

### AI factual safeguards

Contexto explícito:

- `FACTS`
- `CLAIMS_ALLOWED`
- `CLAIMS_FORBIDDEN` / `UNKNOWN`

Se faltar fato: não inventar. Placeholder permitido (“Adicione aqui uma prova real”).  
Proibido inventar: depoimentos, clientes, números, resultados, certificações, garantias, credenciais.

## Media

Separar:

| Store | Uso |
| --- | --- |
| PRIVATE_CAMPAIGN_DATA | uploads de campanha (já existente) |
| PUBLIC_LANDING_PAGE_MEDIA | imagens da landing (público via CDN/blob dedicado) |

Não reutilizar automaticamente o store privado. Upload ainda **não implementado**.

## Forms

V1 (planejado, não implementado):

- Campos limitados: `name`, `email`, `phone`, `message` + consent opcional
- Server validation, rate limit, honeypot, ownership, privacy
- Sem campos arbitrários perigosos

## CTAs

Tipos: WhatsApp (number + message template), external URL, internal route, form anchor.  
Bloquear `javascript:`, `data:` e protocolos inseguros.

## Measurement V1 proposal

Eventos nativos associados ao `LandingPageProject` (não misturar com analytics educacional):

`page_view` · `cta_click` · `whatsapp_click` · `form_start` · `form_submit` · `booking_click` · `purchase_click` · `custom_conversion` (allowlist)

Armazenamento agregável; sem custom JS; consentimento a avaliar.

## Preview architecture

- Rota autenticada (ou token assinada de curta duração) renderiza **draft**
- Não indexável; não confundir com URL pública

## Public URL recommendation

**`/p/[slug]`** sob `alexandrefeio.com.br`

- Simples, sem DNS customizado
- Evita conflito com `/cursos`, `/aulas`, `/app`
- Custom domain: **DEFERRED**

## SEO

Default das landing pages dos alunos: **`noindex, follow`** (ou `noindex, nofollow` se preferível na implementação).  
Objetivo: tráfego/compartilhamento/conversão sem contaminar SEO da marca com UGC. Indexação configurável = futuro.

## Security / Privacy

- Ownership estrito no draft/preview/publish
- Sanitização de URLs e telefones
- Sem script injection
- Leads/forms: retenção e LGPD = open business decision
- Entitlement do curso ≠ política de hosting da página publicada (separar conceitos)

## Deferred

- Custom domain
- Exportar código
- Editor gráfico livre / Canva-like
- Crawler/Lighthouse automático
- Multi-idioma
- A/B testing

## Open business decisions

1. Landing hospedada indefinidamente após compra única?
2. Limite de páginas por usuário?
3. Limite de leads / form submissions?
4. Custom domain será pago?
5. Limite de gerações de IA?
6. Limite de armazenamento de mídia?
7. Exportação de código será futura (e em que termos)?
8. Retenção de analytics/leads?

Não decidir preços nesta ADR. Separar **curso/entitlement** de **hosting/publication policy**.

## Phase 2 — renderer e preview

- `LandingPageRenderer` recebe documento já validado (`parseLandingPageDocument`) e `mode`: `PREVIEW` | `PUBLIC`.
- Componentes apresentacionais do registry V1. Sem `dangerouslySetInnerHTML`, CSS arbitrário ou className vinda do documento.
- Theme vira `--lp-primary`, `--lp-background`, `--lp-text`, `--lp-content-width` e `--lp-radius` a partir de hex e tokens allowlisted.
- Seções `enabled` ordenadas por `order`, posição original e `id`.
- `resolveLandingPageAction` gera href sanitizado (WhatsApp, URL http(s), rota interna, âncora). No `PREVIEW` os controles são botões e o formulário não envia.
- Preview autenticado em `/app/landing-pages/[id]/preview`: somente o dono, lê `draftDocument`, `noindex, nofollow`, fora do sitemap, sem analytics, sem progresso e sem mutação.
- Canvas do aluno não inclui marca Alexandre Feio. O chrome da área logada fica fora do canvas.
- A rota pública `/p/[slug]` e o modo `PUBLIC` com interações reais ficam para a phase de publicação.

## Phase 3 — guided wireframe engine

- `WireframeContextV1` é um contrato de domínio, independente de resultados de aula. O adaptador implementado é `buildWireframeContextFromLandingPageProject`.
- `generateWireframePlan` é determinístico e sem IA. Devolve `WireframePlanV1` com `engineVersion` `GUIDED_WIREFRAME_ENGINE_V1`, estratégia, propósito, `reasonCode`, avisos, confiança e `planFingerprint`.
- Estratégias por precedência explícita: contexto insuficiente, `TRUST_HEAVY`, `EXPLANATORY`, `CONVERSATIONAL`, `FOCUSED`, senão `BALANCED`.
- Contexto `INSUFFICIENT` produz plano mínimo (hero, CTA, rodapé), confiança `LIMITED` e aviso pedindo mais contexto.
- `materializeWireframePlan` cria seções do registry com `contentStatus: PLACEHOLDER`. Não escreve copy final, depoimento, número ou benefício inventado.
- `PROBLEM` e `SOLUTION` entram no registry V1, compatíveis com documentos antigos.
- `applyGuidedWireframe` só grava em rascunho vazio (`ONLY_IF_EMPTY`), com a revisão otimista da phase 1. `REPLACE_ALL` existe no contrato e permanece desligado. Tema, conversão, medição e mídia são preservados.
- Gerar o plano não altera o projeto. O preview continua sem analytics.

## Aula 4 — strategy.brief

- `draftDocument.strategy` é opcional. `schemaVersion` permanece 1. Documentos antigos continuam válidos.
- `strategy.brief` (`ConversionPageBriefV1`) é a fonte estratégica. `conversion` recebe só a configuração operacional compatível (`primaryAction`, `secondaryAction`, `businessOutcome`), no mesmo save atômico.
- Intenção sem dados suficientes (WhatsApp sem telefone, formulário, URL ainda vazia) permanece no brief e não entra em `conversion`.
- `buildWireframeContextFromLandingPageProject` adapta o brief para um contexto `PARTIAL` enquanto a jornada não existe. Não chama o motor e não cria seções.
- Concluir a aula não muda o status do projeto para `READY_TO_PREVIEW`.

## Aula 5 — strategy.decisionJourney

- `strategy.decisionJourney` (`VisitorDecisionJourneyV1`) é opcional. `schemaVersion` permanece 1.
- `brief.objections` continua a lista factual. A jornada classifica essa mesma lista. Salvar a jornada atualiza as duas no mesmo documento.
- Troca de ação principal só ocorre com confirmação explícita e, nesse caso, atualiza brief, `conversion` e jornada na mesma revisão.
- Com brief e jornada completos, o adaptador devolve `SUFFICIENT`. Sinais `UNKNOWN` devolvem `PARTIAL`. Sem brief, `INSUFFICIENT`.
- Salvar a Aula 5 não chama o motor e não materializa seções. O status permanece `DRAFT`.

## Aula 6 — strategy.wireframe e seções

- `ReviewedWireframePlanV1` é validado no servidor. O cliente pode reordenar, remover seções opcionais e adicionar tipos ainda disponíveis. A policy de cardinalidade fica centralizada: hero e rodapé são obrigatórios, CTA aceita no máximo duas ocorrências e os demais tipos aceitam no máximo uma.
- `proposeWireframeFromDocument` chama `buildWireframeContextFromLandingPageProject` e `generateWireframePlan`. Não grava seções. Contexto `INSUFFICIENT` não pode ser aplicado. Contexto `PARTIAL` gera recomendação inicial.
- A primeira aplicação só entra em rascunho vazio. Grava `strategy.wireframe` (origem da decisão, sem copiar o conteúdo das seções) e materializa `draftDocument.sections` com `contentStatus: PLACEHOLDER`.
- `READY_TO_PREVIEW` significa apenas que há uma estrutura válida para visualizar. Não é prontidão de publicação e esta aula não transiciona para `PUBLISHED`.
- Depois da materialização, `updateLandingPageWireframeStructure` altera ordem, inclusão e remoção segura. Seção com conteúdo `DRAFT` ou `APPROVED` não é removida. Reordenar preserva id, conteúdo e status. Toda mutation usa `expectedRevision`.
- O indicador “Conteúdo provisório” aparece só no modo `PREVIEW`.

## Implementation phases

| Phase | Escopo |
| --- | --- |
| 1 | IMPLEMENTED — core model + schemas tipados + persistência draft |
| 2 | IMPLEMENTED — renderer controlado + preview autenticado do draft |
| 3 | IMPLEMENTED — motor guiado de wireframe, sem IA |
| 4 | IMPLEMENTED — copy assist por seção e provider OpenAI ao vivo, sem Aula 7 |
| 5 | Theme / design tokens |
| 6 | Trust + public media |
| 7 | Responsive review (desktop/mobile preview) |
| 8 | CTA/form + measurement nativo |
| 9 | Publish / snapshot / rota `/p/[slug]` |
| 10 | Integração Aula 12 (revisão final + publicação) |

Conteúdo pedagógico: Aulas 1–6 com conteúdo interno. Aulas 7–12 ainda não produzidas. O núcleo da Phase 4 e o provider OpenAI ao vivo estão implementados. A Aula 7 ainda não foi escrita.

## Phase 4 — copy assist core

- A geração é por seção. Não existe geração da página inteira.
- `LANDING_PAGE_COPY_PROMPT_V1` identifica o contrato do pedido. O domínio não conhece SDK nem credencial.
- `LandingPageCopyProvider` é a abstração. O resolver devolve o adapter OpenAI quando `OPENAI_API_KEY` existe no servidor. Sem chave, a geração responde indisponível. Não há fallback para o provider falso fora dos testes.
- `buildCopyContextForSection` envia só fatos informados pelo aluno e necessários àquela seção. Esses fatos não são verificados externamente.
- A política separa fato, reformulação permitida e afirmação proibida. Números, depoimentos, garantias, certificações, clientes e urgência que não estejam nos fatos são recusados. O detector não é universal; a revisão humana continua obrigatória.
- Texto do aluno entra como dado, não como instrução. Um prompt livre não faz parte da API.
- `generateLandingPageCopySuggestions` não grava o rascunho. `applyLandingPageCopy` valida de novo e marca `DRAFT`. `approveLandingPageSectionCopy` só promove `DRAFT` sem fatos pendentes para `APPROVED`. Editar uma seção aprovada volta para `DRAFT`.
- O preview mostra “Conteúdo provisório” e “Em revisão”. O modo público não mostra esses avisos.
- Logs operacionais não carregam oferta, objeções, copy nem resposta do provider. Nada disso vai para analytics.
- Limitações: não há fonte externa para decidir se um fato é verdadeiro; seções de processo, confiança e FAQ ficam sem texto inventado enquanto os fatos específicos não existirem.

## Phase 4 — provider OpenAI

- Phase 4 core: IMPLEMENTED. Phase 4 live provider: IMPLEMENTED. O smoke sintético passou.
- Provider: OpenAI Responses API, SDK oficial `openai`, somente no servidor. Sem Assistants API e sem chamada no browser.
- Modelo: `resolveCopyModel()`. Padrão `gpt-6-luna`. `OPENAI_COPY_MODEL` troca o modelo, por exemplo para `gpt-6-sol`, sem alterar código. Não há fallback automático de modelo.
- Structured Outputs: `text.format.type = json_schema` com `strict: true`. A resposta ainda passa pelo schema interno e pelos guards factuais.
- Cada chamada é stateless: `store: false`, sem conversation e sem tools. O esforço de raciocínio fica em `none`.
- O contexto enviado é o de `buildCopyContextForSection`. Texto do aluno entra delimitado como dado.
- Timeout do provider ao vivo: 25 segundos. Há no máximo uma nova tentativa para falha transitória de rede ou HTTP 5xx. Rate limit, recusa e erro de configuração não são repetidos.
- Limite técnico por usuário: 10 gerações em 10 minutos, na memória do processo. Não é plano comercial nem limite distribuído.
- A entrada autenticada `requestLandingPageCopySuggestions` exige sessão, posse da página e a política do curso. Com o curso em DRAFT, só o papel editorial ADMIN passa. Usuário comum não gera. A Aula 7 não tem UI.
- Aprovação humana continua obrigatória. Gerar não grava o rascunho e não publica.

## Consequences

- Promessa comercial alinhada a entrega real (página publicada).
- Complexidade de produto sobe (builder, hosting, leads, mídia).
- Course permanece DRAFT / NOT_FOR_SALE até core mínimo e decisão de release.
- Curso 1 (tráfego) permanece isolado.
