# ADR — Landing Page Builder V1

Status: **ACCEPTED — PHASE 1 a PHASE 9 com núcleo implementado**. O hardening pré-lançamento adiciona limitador durável, proteção dos endpoints públicos e limpeza técnica de mídia órfã. O runtime público fica desligado em produção até o corte explícito. O curso permanece DRAFT.

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

Não reutilizar automaticamente o store privado. O núcleo de upload público está na Phase 6. A publicação da página continua adiada.

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
| 4 | IMPLEMENTED — copy assist por seção, fatos complementares, cobertura da aula e provider OpenAI ao vivo |
| 5 | IMPLEMENTED CORE — tema controlado, contraste e ajustes visuais por seção |
| 6 | IMPLEMENTED CORE — mídia pública, posse, upload e provas de confiança informadas pelo aluno |
| 7 | IMPLEMENTED CORE — revisão de experiência, presets de viewport e findings determinísticos |
| 8 | CTA/form + measurement nativo |
| 9 | Publish / snapshot / rota `/p/[slug]` |
| 10 | Integração Aula 12 (revisão final + publicação) |

Conteúdo pedagógico: Aulas 1–9 com conteúdo interno. Aulas 10–12 ainda não produzidas. A Aula 9 confirma o plano de confiança no mesmo projeto. A landing page e o curso permanecem sem publicação pública.

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
- Limitações: não há fonte externa para decidir se um fato é verdadeiro. Processo, confiança e FAQ só recebem sugestão quando `strategy.copyFacts` traz etapas, provas ou respostas. Esses fatos são `USER_PROVIDED`, não prova verificada.
- `CopyCoverageV1` mede seções principais aprovadas e seções opcionais revisadas, sem percentual. A conclusão da Aula 7 exige `HERO` aprovado e todas as seções principais presentes aprovadas, sem texto provisório. `PROCESS`, `FAQ`, `TRUST` e `FORM` não bloqueiam. `CONTACT` e `FOOTER` não usam IA.
- O `LessonResult` “Copy da minha landing page” guarda identificador, versão, contagens e revisão. Não duplica a copy.

## Phase 4 — provider OpenAI

- Phase 4 core: IMPLEMENTED. Phase 4 live provider: IMPLEMENTED. O smoke sintético passou.
- Provider: OpenAI Responses API, SDK oficial `openai`, somente no servidor. Sem Assistants API e sem chamada no browser.
- Modelo: `resolveCopyModel()`. Padrão `gpt-6-luna`. `OPENAI_COPY_MODEL` troca o modelo, por exemplo para `gpt-6-sol`, sem alterar código. Não há fallback automático de modelo.
- Structured Outputs: `text.format.type = json_schema` com `strict: true`. A resposta ainda passa pelo schema interno e pelos guards factuais.
- Cada chamada é stateless: `store: false`, sem conversation e sem tools. O esforço de raciocínio fica em `none`.
- O contexto enviado é o de `buildCopyContextForSection`. Texto do aluno entra delimitado como dado.
- Timeout do provider ao vivo: 25 segundos. Há no máximo uma nova tentativa para falha transitória de rede ou HTTP 5xx. Rate limit, recusa e erro de configuração não são repetidos.
- Limite técnico por usuário: 10 gerações em 10 minutos, na memória do processo. Não é plano comercial nem limite distribuído. BEFORE_PUBLIC_RELEASE: substituir o limitador em memória por um limitador durável e distribuído. Enquanto o curso permanece DRAFT, o limite atual é aceitável.
- A entrada autenticada `requestLandingPageCopySuggestions` exige sessão, posse da página e a política do curso. Com o curso em DRAFT, só o papel editorial ADMIN passa por essa entrada. A Aula 7 usa outro caminho: aula publicada internamente, entitlement e posse da página. Usuário sem a aula não gera. A interface do aluno não mostra modelo, provedor nem versão do prompt.
- Aprovação humana continua obrigatória. Gerar não grava o rascunho e não publica. Não existe geração da página inteira.

## Phase 5 — tema e sistema visual

- Phase 5 core: IMPLEMENTED. A Aula 8 usa esse núcleo e está completa no código.
- `LandingPageThemeV1` guarda papéis de cor, tipografia, largura, espaçamento, densidade, raio e estilo de botão. `schemaVersion` do documento permanece 1. Um tema antigo, com `primaryColor` e `fontFamily: "sans" | "serif"`, ainda é lido e convertido.
- Cores aceitam só hex normalizado (`#rrggbb`). `rgb()`, `hsl()`, `var()`, `url()`, `calc()` e `color-mix()` são recusados. Não há CSS, className nem fonte por URL.
- Famílias internas: `SYSTEM_SANS`, `INTER` e `SERIF`. Nenhuma é a fonte da marca da plataforma. O tema padrão é neutro.
- Presets `CLARO`, `SOBRIO`, `CONTRASTE` e `EDITORIAL` só preenchem o tema. Depois disso a personalização continua aberta. Não há preset por setor e não há paleta gerada por IA.
- O contraste é uma checagem parcial e determinística, não uma auditoria completa. Texto sobre fundo abaixo de 4.5 é bloqueado. Texto do botão sobre a cor principal, texto sobre superfície e texto atenuado abaixo de 3.0 também são bloqueados. Entre 3.0 e 4.5 esses papéis geram atenção, sem botão para ignorar a regra.
- Cada seção pode referenciar `backgroundRole` (`DEFAULT`, `SURFACE`, `PRIMARY`, `ACCENT`), alinhamento `LEFT` ou `CENTER` e ênfase `NORMAL` ou `FEATURED`. A cor não é salva na seção. Variantes só existem quando o schema e o renderer já as desenham. `HERO` `split` não exige imagem.
- `updateLandingPageTheme` e `updateLandingPageSectionVisualSettings` exigem posse e `expectedRevision`. Não mudam conteúdo, status da copy, ordem, estratégia, conversão nem medição. O projeto não vai para `PUBLISHED` nem `READY_TO_PUBLISH`.
- `evaluateVisualHierarchy` devolve avisos determinísticos e não altera o documento. Muitas seções em destaque, fundo primário repetido e alinhamento central em toda a página geram aviso.
- Mídia, upload e publicação continuam fora desta fase. O limitador de copy em memória permanece, com a troca durável marcada como `BEFORE_PUBLIC_RELEASE`.

## Aula 8 — direção visual

- Aula 8: COMPLETE no código. A Aula 9 usa o núcleo de confiança e também está completa no código. A Aula 10 usa o núcleo de experiência e também está completa no código.
- A ferramenta `LANDING_PAGE_VISUAL_DIRECTION_V1` usa o tema, o contraste, os presets e os avisos da Phase 5. Não chama IA e não cria outra landing page.
- `saveLandingPageVisualDirection` grava tema, ajustes visuais das seções e `strategy.visualDirection` numa única atualização de revisão. Conteúdo, status da copy, ordem, brief, jornada, wireframe, fatos, conversão e medição permanecem.
- `strategy.visualDirection` guarda a origem, a prioridade visual, as seções em destaque, os avisos revisados, a impressão digital do tema e o resumo visual das seções. Não duplica o tema.
- O tema padrão pode ser confirmado. Contraste crítico bloqueia o salvamento. Avisos de hierarquia não bloqueiam.
- O `LessonResult` “Direção visual da minha landing page” guarda identificador, versão, origem, prioridade, impressão digital, contagens e revisão. Não copia a paleta.
- O projeto permanece `READY_TO_PREVIEW`. O limitador de copy em memória permanece, com a troca durável marcada como `BEFORE_PUBLIC_RELEASE`.

## Phase 6 — confiança e mídia pública

- Phase 6 core: IMPLEMENTED. A Aula 9 usa esse núcleo e está completa no código. A Aula 10 não reabre esse núcleo.
- O inventário da aula lê `strategy.copyFacts.trustProofs`. Não há segunda fonte de provas.
- A seleção aceita só provas `READY_FOR_DISPLAY` do mesmo projeto. Depoimento exibido exige consentimento. Um negócio sem depoimento pode concluir com outra prova real.
- O caminho sem provas prontas é válido. `strategy.trustPlan.decision` fica `NO_PROOF_YET` e `nextActions` lista passos reais, sem inventar prova.
- `strategy.trustPlan` é o resumo da decisão. Não copia texto de depoimento, case, credencial nem URL de mídia.
- O envio ao vivo do armazenamento público ainda não foi confirmado neste ambiente. `LIVE_MEDIA_STORE_READY=false`. A aula segue com o aviso de envio indisponível e não bloqueia o cadastro. BEFORE_PUBLIC_RELEASE: repetir o smoke sintético de upload, leitura e exclusão antes do release.
- BEFORE_PUBLIC_RELEASE: o limitador de copy e o limitador de upload de mídia continuam em memória. A troca durável fica para antes do release público.
- `LandingPageMedia` guarda a mídia da landing. A identidade é o registro e o `storageKey`, não a URL. O documento referencia `mediaId`.
- O armazenamento é `PUBLIC_LANDING_PAGE_MEDIA`, com acesso público e prefixo opaco `landing-media/`. Não reutiliza o adapter privado de planilhas de campanha.
- Formatos aceitos: JPEG, PNG e WebP, conferidos pelo tipo e pela assinatura. SVG, GIF, HTML, PDF e arquivo genérico são recusados. A extensão não autoriza o arquivo.
- Logo até 5 MB. Demais imagens até 10 MB. No máximo 20 assets ativos por landing page. No máximo 20 inícios de upload por usuário a cada 10 minutos, na memória do processo.
- BEFORE_PUBLIC_RELEASE: revisar o teto comercial de mídia. A retenção definitiva do arquivo continua em aberto. Um upload `UPLOADING` abandonado pode ser marcado `FAILED` por `expireAbandonedLandingPageUploads`. Não há cron. A exclusão futura do projeto precisa limpar a mídia antes: a chave estrangeira é `ON DELETE RESTRICT` e não apaga o arquivo sozinha.
- JPEG remove segmentos APP1 e APP13. PNG remove chunks `eXIf`, `tEXt`, `zTXt` e `iTXt`. WebP com chunk EXIF é recusado. Não há pipeline de redimensionamento nem editor de corte.
- A URL pública não leva e-mail, nome, título, oferta nem identificador previsível desnecessário. Operações de lista, leitura administrativa e exclusão continuam só do dono.
- Excluir mídia referenciada devolve `LANDING_PAGE_MEDIA_IN_USE`. Se a remoção no armazenamento falha, o registro não vai para `DELETED`.
- `HERO` aceita `mediaRef` opcional. A variante `split` mostra a imagem quando ela está pronta e, sem imagem, mantém o texto em duas colunas. `PORTFOLIO` e `TESTIMONIALS` entram no registry V1. O portfólio aceita até 12 itens. Depoimento sem confirmação não fica pronto e não vira card vazio.
- As provas continuam em `strategy.copyFacts.trustProofs`. Tipos: `TESTIMONIAL`, `PORTFOLIO`, `CASE`, `CREDENTIAL`, `EXPERIENCE`, `PROCESS_EVIDENCE`, `BUSINESS_INFORMATION` e `OTHER`. `READY_FOR_DISPLAY` significa que o aluno confirmou o uso. Não existe status `VERIFIED` nem selo de verificação da plataforma.
- Depoimento pronto exige texto, autor e `consentConfirmed`. A assistência de copy pode receber prova pronta como texto e continua sem escrever depoimento. Não recebe arquivo nem URL. Não há geração de imagem.
- O preview do dono pode mostrar a mídia real, segue `noindex` e não mede analytics. A publicação pública e a rota `/p/[slug]` continuam fora. O curso permanece DRAFT e NOT_FOR_SALE.
- O limitador de copy em memória permanece, com a troca durável marcada como `BEFORE_PUBLIC_RELEASE`.

## Phase 7 — revisão responsiva e experiência

- Phase 7 core: IMPLEMENTED. A Aula 10 usa esse núcleo: não duplica a avaliação, os presets, o motor de findings nem a gravação.
- `LandingPageExperienceReviewV1` fica em `draftDocument.experienceReview`. `strategy.experienceReview` guarda só versão, status, revisão conferida, viewports e contagens. Não copia texto de finding nem observação do aluno.
- Presets de viewport: `MOBILE_SMALL` 320, `MOBILE` 375, `TABLET` 768 e `DESKTOP` 1280. O preview autenticado usa o mesmo renderer. A largura só limita o canvas. Não há moldura de aparelho.
- A conclusão pedagógica pede os quatro presets. `READY_FOR_NEXT_STEP` não significa pronto para publicar.
- Findings têm categoria, severidade `INFO`, `ATTENTION` ou `BLOCKER`, origem `SYSTEM` ou `USER` e status `OPEN`, `RESOLVED`, `DEFERRED` ou `NOT_APPLICABLE`. Não há severidade `CRITICAL` e não há nota de experiência.
- `evaluateLandingPageExperience` é determinístico e não grava. `saveLandingPageExperienceReview` reavalia, exige posse e `expectedRevision`, e faz uma atualização atômica. Um finding de sistema que continua válido volta a `OPEN`. `BLOCKER` não pode ser adiado.
- `saveLandingPageExperienceReview` grava `reviewedDraftRevision` como `expectedRevision + 1`, a mesma revisão que o rascunho passa a ter. A gravação em si não deixa a revisão `STALE`. Se `draftRevision` mudar depois, o status efetivo fica `STALE` e a aula pede nova revisão. O status `STALE` não é gravado.
- O `LessonResult` da Aula 10 só é gravado quando o status efetivo é `READY_FOR_NEXT_STEP`. Uma revisão incompleta permanece no rascunho. O projeto continua `READY_TO_PREVIEW`.
- `strategy.experienceReview` pode incluir `deferredCount` e `userFindingCount`. O texto dos findings e as observações do aluno ficam só na revisão canônica.
- Códigos de ação: `REVIEW_COPY`, `REVIEW_THEME`, `REVIEW_TRUST`, `CONFIGURE_ACTION`, `REVIEW_FORM` e `REVIEW_MEDIA`. O motor não monta URL de aula.
- Capacidades desta fase: `formsFunctional=false`, `publicationAvailable=false`, `measurementAvailable=false`. Formulário sem envio é limitação da plataforma, não bloqueio do aluno.
- O contraste reutiliza `assessThemeContrast`. A hierarquia reutiliza `evaluateVisualHierarchy`.
- A rota `/dev/landing-experience-fixture` só existe fora de produção, responde `noindex` e não entra no sitemap. Não cria `LandingPageProject`. O teste no navegador, com documento sintético, passou em 320, 375, 768 e 1280: sem overflow horizontal, CTA visível, texto longo quebrando, portfólio e depoimentos em coluna no celular e em grade no desktop. A pergunta da FAQ abre. O renderer usa container queries para a largura do canvas, não um renderer por aparelho.
- BEFORE_PUBLIC_RELEASE, ainda em aberto: limitador distribuído de copy, limitador distribuído de upload, smoke do armazenamento público ao vivo, retenção de mídia e limpeza de arquivo órfão.

## Phase 8 — ações, formulário e mensuração

- Phase 8 core: IMPLEMENTED. A Aula 11 usa esse núcleo. Não há rota `/p/[slug]` nem envio público.
- `LandingPageActionV1` reutiliza os tipos já gravados: `WHATSAPP`, `EXTERNAL_URL`, `INTERNAL_ROUTE` e `FORM_ANCHOR`. Não há ação `PHONE` nem `EMAIL`. O rótulo visível continua independente do destino.
- O telefone de WhatsApp é normalizado para dígitos. A URL `https://wa.me` é gerada por `buildSafeWhatsAppUrl`. Link externo salvo só aceita `https`. `javascript:`, `data:`, `file:` e `vbscript:` continuam rejeitados.
- `FORM_ANCHOR` aponta para o id de uma seção `FORM` da mesma página. A gravação recusa WhatsApp sem número, link sem URL https e formulário sem seção válida.
- `LandingPageFormV1` aceita no máximo 8 campos dos tipos `NAME`, `EMAIL`, `PHONE`, `COMPANY` e `MESSAGE`. O formato antigo `name` / `email` / `phone` / `message` continua válido. Não há HTML, arquivo, senha, pagamento, data de nascimento nem CPF. E-mail e telefone não são obrigatórios juntos.
- O envio fica na plataforma. Não há webhook, encaminhamento de e-mail, Zapier, CRM nem API externa. `submitLandingPageForm` é o núcleo, separado de qualquer adapter HTTP.
- `LandingPageLead` guarda id, projeto, publicação opcional, seção, dados estruturados, status `NEW` ou `ARCHIVED` e chave de idempotência. Não guarda IP, user agent, cabeçalhos nem requisição bruta. Consulta e arquivamento são do dono do projeto. Não há exportação CSV nem e-mail a cada lead.
- Honeypot preenchido não cria lead e não incrementa conversão. A chave de idempotência impede outro lead no retry. O limitador de envio é em memória, por projeto. BEFORE_PUBLIC_RELEASE: limitador distribuído de envio. CAPTCHA, se necessário, também fica para antes do release.
- OPEN BUSINESS DECISION: política de retenção de leads. Não há exclusão automática. O dado do lead usa a proteção do banco e é privado do dono. Não há criptografia própria nesta fase.
- `LandingPageMeasurementV1` vive em `draftDocument.measurement`. A fonte canônica é `enabledEvents`. O formato antigo `{ enabled, events }` ainda é lido: desligado vira lista vazia; eventos fora da V1 são descartados. A conversão principal não é escolhida sozinha.
- Eventos da V1: `PAGE_VIEW`, `CTA_CLICK`, `WHATSAPP_CLICK`, `FORM_START` e `FORM_SUBMIT`. Um clique de WhatsApp pode contar os dois primeiros eventos da lista de clique, mas a conversão principal usa um só tipo. `FORM_SUBMIT` só incrementa depois que o lead foi gravado. Preview, editor e aula não gravam métrica.
- `LandingPageMetricDaily` agrega por projeto, publicação, data e evento. Não há linha por visita, fingerprint, cookie persistente nem id de sessão. A passagem de início do formulário para envio é uma razão de contagens, não de pessoas. OPEN BUSINESS DECISION: retenção dessas contagens.
- Se o lead foi salvo e a métrica falha, o envio continua aceito. O log operacional não recebe o payload. A prioridade é a ação de negócio.
- Os eventos da landing do aluno não vão para o GTM, o GA4 nem o Meta da plataforma. Analytics educacional continua limitado a aula e ferramenta.
- `strategy.measurementPlan` é só o resumo pedagógico. Ação, formulário e mensuração têm uma gravação conjunta quando entram na mesma decisão.
- Alterar ação ou formulário deixa a revisão de experiência `STALE`. Gravar só a mensuração, sem mudar a página visível, mantém a revisão atual. O projeto continua `READY_TO_PREVIEW`.
- Capacidades: `formsFunctional=true` significa que o núcleo de envio está pronto para um runtime público futuro. O preview continua sem enviar. `measurementAvailable=true`. `publicationAvailable=false`.
- BEFORE_PUBLIC_RELEASE, além das dívidas anteriores: limitador distribuído de envio de formulário, política de retenção de leads, decisão de CAPTCHA e política de retenção das contagens.

## Aula 11 — plano de mensuração

- A aula `configure-o-que-precisa-ser-medido` confirma o plano. Ela não duplica schemas de ação, formulário ou mensuração, nem o validador, nem o resumo.
- `strategy.measurementPlan` recebe `confirmed: true` somente quando a aula confirma. Um plano antigo, sem esse campo, continua válido. A fonte canônica segue em `draftDocument.measurement`. Ação, formulário e leads não são copiados para o resumo.
- Alterar só `enabledEvents` e `primaryConversionEvent` não deixa `experienceReview` em `STALE`. Alterar ação, campos ou copy do formulário deixa. A aula pode ser concluída com a revisão desatualizada. `futurePublicationBlockedByStaleExperienceReview` deixa a publicação detectar esse estado. Não existe `READY_TO_PUBLISH`. A rota `/p/[slug]` chega na Phase 9 e permanece noindex, fora do sitemap e desligada em produção.
- O `LessonResult` guarda o id do projeto, a versão, o tipo da ação, os eventos, a conversão principal, a presença e a quantidade de campos, o status efetivo da revisão, a confirmação, a revisão do rascunho e o instante. Não guarda telefone, URL externa, valores do formulário nem lead.
- A simulação da aula e o preview não gravam `LandingPageMetricDaily` nem `LandingPageLead`. Não há GA4, GTM nem Meta Pixel na landing do aluno.
- O projeto permanece `READY_TO_PREVIEW`. O curso permanece DRAFT e NOT_FOR_SALE.
- BEFORE_PUBLIC_RELEASE continua em aberto: limitador distribuído de copy, limitador distribuído de upload, limitador distribuído de envio, smoke do Blob ao vivo, retenção de mídia, limpeza de arquivo órfão, retenção de leads, decisão de CAPTCHA e retenção das contagens.

## Phase 9 — publicação e runtime público

- Phase 9 core: IMPLEMENTED. A Aula 12 usa esse núcleo. O curso permanece DRAFT e NOT_FOR_SALE.
- `LandingPagePublicationSnapshotV1` guarda só o necessário para renderizar e operar a página: tema, seções, ações, formulário, mensuração, mídia pública e provas selecionadas. Não entra `strategy`, `experienceReview`, `copyFacts`, findings, `LessonResult`, lead, prompt nem estado do editor.
- `validatePublicationSnapshot` rejeita campo interno. `buildLandingPagePublicationSnapshot` não grava banco. O hash é determinístico.
- A linha de `LandingPagePublication` não recebe atualização de conteúdo. Nova versão pública só nasce em nova publicação. `publishedPublicationId` é a versão ativa. A versão é única por projeto e cresce sempre.
- A publicação exige revisão efetiva `READY_FOR_NEXT_STEP`. Revisão `STALE` bloqueia. Página sem prova e página sem mídia podem ser publicadas. Mídia referenciada precisa estar pronta. Depoimento exibido precisa de consentimento.
- Rollback cria uma versão nova com o snapshot da versão escolhida e `rollbackSourcePublicationId`. A linha antiga permanece. Despublicar zera o ponteiro ativo e não apaga histórico, lead, métrica nem mídia. O slug continua travado.
- A rota `/p/[slug]` lê a publicação ativa. Sem versão ativa, responde 404. Não renderiza rascunho. O renderer em modo `PUBLIC` liga as ações. O preview continua sem ação, sem lead e sem métrica.
- WhatsApp usa `buildSafeWhatsAppUrl`. Link externo continua `https`. Rota interna não abre `/admin`, `/app`, `/diretor` nem API. O formulário público valida o schema do snapshot, grava `publicationId` e só então conta `FORM_SUBMIT`.
- `PAGE_VIEW`, clique e `FORM_START` saem do cliente, uma vez por carregamento. `FORM_SUBMIT` não é aceito no endpoint genérico de eventos. Não há tabela de evento bruto nem fingerprint.
- `LANDING_PAGE_PUBLIC_RUNTIME_ENABLED` é variável de servidor. Sem o valor `true`, `/p` responde 404. Em produção, a ausência da variável deixa o runtime desligado. Não há `NEXT_PUBLIC_` para esse gate.
- Toda publicação desta V1 sai com `noindex`. `/p/[slug]` não entra no sitemap. O layout raiz não injeta o GTM nem o pixel da plataforma nessa rota.
- O slug antigo `mensuracao-da-pagina` é reconciliado no futuro `catalog:deploy`: só o legado vira o slug canônico; se os dois existirem, o deploy falha e não apaga linha. Este comando não foi executado.
- `publicationAvailable=true`. `LIVE_MEDIA_STORE_READY=false`. Página sem mídia publica. Mídia inválida bloqueia.
- BEFORE_PUBLIC_RELEASE, ainda em aberto: limitador distribuído de copy, de upload e de envio; proteção adicional do endpoint de eventos, se necessária; smoke da APIMG ao vivo; retenção de mídia; limpeza de arquivo órfão; retenção de leads; decisão de CAPTCHA; retenção das contagens; decisão do gate de produção; revisão legal e de privacidade dos formulários públicos.

## Aula 12 — revisão e publicação

- A aula `revisao-antes-do-trafego` é a última do curso. Ela não duplica a avaliação de prontidão nem o serviço de publicação. Bloqueios levam de volta às aulas 7–11. Avisos pedem reconhecimento e não podem incluir um código de bloqueio.
- A conclusão pedagógica exige publicação ativa, snapshot válido, runtime público ligado naquele ambiente e resolução da rota pelo slug ativo. Uma linha gravada com o gate desligado não conclui a aula e não produz a mensagem de página no ar.
- O aluno vê a diferença entre rascunho e versão publicada, o aviso de alterações ainda não publicadas e o histórico sem o JSON do snapshot. Versão idêntica não cria outra linha. Restaurar uma versão cria uma versão nova baseada nela.
- O `LessonResult` “Publicação da minha landing page” guarda identificadores, versão, slug, caminho, tipo da ação, evento de conversão, contagens de aviso e a revisão de origem. Não guarda snapshot, telefone, URL externa, prova nem lead. O host é derivado, não gravado.
- O progresso do curso continua o da engine existente: a última aula concluída pode levar o curso a 100%. Não há progresso paralelo.
- O curso permanece DRAFT, fora do catálogo público e NOT_FOR_SALE. `catalog:deploy` não foi executado. `LANDING_PAGE_PUBLIC_RUNTIME_ENABLED` permanece ausente ou falso em produção. A rota pública continua `noindex` e fora do sitemap.
- BEFORE_PUBLIC_RELEASE, consolidado depois da Aula 12: limitador distribuído de copy; limitador distribuído de upload de mídia; limitador distribuído de envio de formulário; decisão de proteção contra abuso do endpoint público de eventos; smoke da APIMG ao vivo; retenção de mídia; limpeza de mídia órfã; retenção de leads; decisão de CAPTCHA ou proteção contra bot; retenção das métricas; revisão final de privacidade e jurídico; ligar o runtime público em produção; smoke público real; smoke responsivo no navegador; decisão de catálogo e commerce do curso.

## PUBLIC RELEASE HARDENING

- O limitador `DurableRateLimiter` usa baldes no Postgres (`namespace`, `hashedKey`, `windowBucket`), com incremento atômico e `expiresAt`. A implementação em memória existe só para o teste isolado. Não há Redis. Copy usa o id do usuário autenticado: 10 gerações a cada 10 minutos. Upload usa o mesmo tipo de chave: 20 inícios a cada 10 minutos. Formulário público usa publicação mais chave de abuso: 5 envios a cada 10 minutos. Evento público usa o mesmo recorte, com teto mais alto, 120 a cada 10 minutos. Estourar o evento descarta a contagem e não bloqueia o clique.
- A chave de abuso é HMAC do endereço normalizado, do namespace e da janela, com `LANDING_PAGE_RATE_LIMIT_SECRET`. O endereço não é gravado. O resumo não vai para analytics, lead, sessão nem resposta. Sem segredo de pelo menos 32 caracteres, a rota pública de produção continua no escuro, mesmo que o flag esteja ligado. Não há segredo padrão.
- O formulário público aceita só `application/json`, corpo até 8000 caracteres, honeypot genérico, idempotência e o limitador durável. `FORM_SUBMIT` continua só no servidor, depois do lead, e é recusado no endpoint genérico.
- A limpeza `cleanupLandingPageMediaOrphans` tem `dryRun` verdadeiro por omissão. Mídia citada no rascunho ou em qualquer publicação histórica não é órfã. A janela de 24 horas é limpeza técnica de upload abandonado, não política de retenção. Falha ao apagar o arquivo não marca o registro como removido.
- CAPTCHA não foi integrado. Com honeypot, limitador, validação e idempotência, `CAPTCHA_REQUIRED_AT_LAUNCH` fica `NOT_REQUIRED_FOR_MVP`.
- Cabeçalhos: `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` sem câmera, microfone e geolocalização. `/p/[slug]` usa `X-Frame-Options: DENY` e `frame-ancestors 'none'`. Não há CSP de `img-src`, então a imagem pública da APIMG e o destino `https://wa.me` continuam possíveis. O conteúdo público segue escapado pelo React. Não há `dangerouslySetInnerHTML` no renderer.
- A página `/privacidade` ainda não descreve formulário de landing, acesso do dono ao lead, contagem agregada, mídia pública nem retenção em aberto. `PRIVACY_POLICY_UPDATE_REQUIRED=true`.
- Open business decisions permanecem sem prazo escolhido: retenção de lead, de mídia e de métrica; cota comercial de geração; direito de hospedagem depois da compra; páginas por usuário; cota de armazenamento. `archivedAt` só registra um arquivamento futuro. Não há exclusão automática.
- `LIVE_MEDIA_STORE_READY` só muda depois de um smoke sintético de upload e leitura na APIMG. O token não entra em cliente, log nem relatório. O runtime de produção permanece desligado. A rota continua `noindex`.

## MEDIA STORAGE

- O provider de produção da mídia pública da landing page é APIMG. O adapter `createApimgLandingPageMediaStorage` implementa `LandingPageMediaStorage`. O domínio não chama a API direto.
- Contrato observado no CadastroCursos, que é a referência com código. O evolUSG só guarda credencial, sem cliente de upload. O envio é `POST` em `APIMG_UPLOAD_URL` (`https://apimg.com.br/v1/upload`), com cabeçalho `X-API-Key` (`APIMG_API_KEY`) e multipart só no campo `file`. `APIMG_UPLOAD_FOLDER` e `APIMG_SITE_UPLOAD_FOLDER` são prefixos lógicos do projeto e não entram no POST. Neste site os valores esperados são `alexandre-feio/uploads` e `alexandre-feio/site`. A mídia da landing page fica no namespace `alexandre-feio/site/landing-pages`. A resposta exigida é `url`, `public_id`, `format` e `bytes`. Sem retry. Timeout de 30 segundos, porque a referência não define um. Não há endpoint de exclusão.
- A credencial fica no servidor. O browser envia o arquivo para a rota da plataforma, que valida dono, MIME, tamanho e EXIF antes do POST. JPEG, PNG e WebP continuam aceitos. SVG continua recusado. O serviço documentado neste repositório aceita até 10 MB. Logo continua em 5 MB. As demais imagens ficam em 10 MB.
- URL pública só entra se for `https` em `apimg.com.br`. `public_id` é o identificador persistido. Sem esses dois campos, a mídia não fica `READY`.
- A exclusão física não é simulada. Arquivo citado por rascunho ou publicação histórica continua bloqueado. A limpeza de órfãos não declara remoção remota. O adapter legado do Vercel Blob permanece no código e não é usado pela landing page. Planilhas de campanha não mudam de armazenamento.
- Open business decisions de retenção, privacidade e CAPTCHA continuam em aberto. A rota pública continua `noindex`.

## Consequences

- Promessa comercial alinhada a entrega real (página publicada).
- Complexidade de produto sobe (builder, hosting, leads, mídia).
- Course permanece DRAFT / NOT_FOR_SALE até core mínimo e decisão de release.
- Curso 1 (tráfego) permanece isolado.
