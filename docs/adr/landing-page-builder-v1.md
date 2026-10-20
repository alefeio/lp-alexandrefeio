# ADR — Landing Page Builder V1

Status: proposto (documentação / arquitetura). Sem implementação de tabelas, UI, IA ou publicação nesta etapa.

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
| slug | único no namespace público (`/p/[slug]`) |
| title | |
| status | `DRAFT` \| `READY_TO_PREVIEW` \| `PUBLISHED` \| `UNPUBLISHED` |
| draftDocument | JSON tipado (sections, theme, ctas, measurement, seo) |
| publishedPublicationId | ponteiro opcional para snapshot ativo |
| createdAt / updatedAt | |

Não substitui `Project`. Relação: **Project 0..1 → LandingPageProject N**.

### LandingPagePublication

| Campo | Notas |
| --- | --- |
| id | |
| landingPageProjectId | |
| version | inteiro monotônico |
| snapshot | cópia congelada do draft no momento do publish |
| publishedAt | |
| publicSlug | slug servido |

Editar draft **não** altera o snapshot ativo até nova publicação.

### LessonResult (compatibilidade)

Cada aula 4–12 pode gravar `LessonResult` com resumo/etapa (brief, wireframe hash, etc.).  
O estado canônico da página vive em `LandingPageProject.draftDocument`.

### Mudanças de modelo necessárias (futuras migrations)

- Tabelas `LandingPageProject`, `LandingPagePublication`
- Opcional: `LandingPageMedia`, `LandingPageLead`, `LandingPageEvent` (agregados)
- Índices: `(userId)`, `(slug)` unique, `(projectId)`
- **Não criar nestas migrations** nesta tarefa documental

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

## Implementation phases

| Phase | Escopo |
| --- | --- |
| 1 | Core model + schemas tipados + persistência draft |
| 2 | Builder renderer + preview autenticado |
| 3 | Guided Wireframe Engine |
| 4 | Copy assist (provider-agnostic + factual guards) |
| 5 | Theme / design tokens |
| 6 | Trust + public media |
| 7 | Responsive review (desktop/mobile preview) |
| 8 | CTA/form + measurement nativo |
| 9 | Publish / snapshot / rota `/p/[slug]` |
| 10 | Integração Aula 12 (revisão final + publicação) |

Conteúdo pedagógico das aulas 4–12 acompanha as phases correspondentes; **Aula 4 não é produzida nesta tarefa**.

## Consequences

- Promessa comercial alinhada a entrega real (página publicada).
- Complexidade de produto sobe (builder, hosting, leads, mídia).
- Course permanece DRAFT / NOT_FOR_SALE até core mínimo e decisão de release.
- Curso 1 (tráfego) permanece isolado.
