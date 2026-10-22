# Sites que Convertem para Pequenos Negócios

## Status de produção

| Campo | Valor |
| --- | --- |
| CONTENT_STATUS | REFRAMED_LANDING_PAGE_BUILDER · Aulas 1–10 COMPLETE · Aulas 11–12 SCAFFOLDED |
| PUBLIC_RELEASE | SUSPENDED (release gratuito anterior suspenso até arquitetura do builder) |
| COMMERCE_RELEASE | NOT_APPROVED |
| Publication | Course DRAFT · Aulas 1–3 FREE e Aulas 4–10 PAID com conteúdo (internamente PUBLISHED no seed) · Aulas 11–12 DRAFT |
| Commerce | NOT_FOR_SALE |
| Catálogo público | não |
| Sitemap / indexação | não (curso fora do público) |

ADR técnico: [`docs/adr/landing-page-builder-v1.md`](../adr/landing-page-builder-v1.md).

## Nova promessa central

**Planeje, construa e publique sua própria landing page enquanto aprende.**

O aluno não termina apenas sabendo “como uma landing page deveria ser”. Termina com uma **landing page real**: planejada, estruturada, escrita, personalizada, responsiva, mensurável e publicada na plataforma.

- “Blueprint” não é benefício público principal (pode existir como termo técnico interno).
- Não é curso de HTML, CSS, JavaScript, WordPress, Next.js ou programação.
- Não há execução de código arbitrário gerado por usuário/LLM.

## Divisão FREE × PAID

| Bloco | Papel | Entrega |
| --- | --- | --- |
| Aulas 1–3 (FREE) | **Descobrir** | mapa de conversão · estrutura digital · diagnóstico |
| Aulas 4–12 (PAID) | **Construir e publicar** | cada etapa enriquece o mesmo `LandingPageProject` até a publicação |

## Identidade

- **Título:** Sites que Convertem para Pequenos Negócios
- **Slug:** `sites-que-convertem`
- **Subtítulo:** Planeje, construa e publique sua própria landing page enquanto aprende.
- **Ordem editorial:** depois de `trafego-pago-na-pratica` (`sortOrder: 1`)
- **Totais:** 12 aulas · 5 módulos · 3 aulas gratuitas
- **Preço planejado do curso completo:** R$ 249,90 (não exibir publicamente enquanto NOT_FOR_SALE)

## Preços planejados

Soma das aulas pagas individuais: **R$ 334,10**  
Soma dos módulos pagos: **R$ 301,60**  
Curso completo: **R$ 249,90** (economia planejada R$ 84,20 / ~25,2%)

Nenhum produto deste curso fica `AVAILABLE` neste estágio.

## Módulos e aulas

### Módulo 1 — Antes de construir (FREE / descobrir)

1. **Seu site realmente ajuda a vender?** (`site-ajuda-a-vender`) — FREE · COMPLETE  
   Resultado: Meu mapa de conversão · Tool: `CONVERSION_JOURNEY_MAP_V1`
2. **Site, landing page ou WhatsApp: o que seu negócio precisa?** (`site-landing-page-ou-whatsapp`) — FREE · COMPLETE  
   Resultado: Minha estrutura digital ideal · Tool: `DIGITAL_PRESENCE_DECISION_V1`
3. **Sua página está pronta para converter?** (`pagina-pronta-para-converter`) — FREE · COMPLETE  
   Resultado: Diagnóstico de prontidão da página · Tool: `CONVERSION_PAGE_READINESS_V1`

### Módulo 2 — Planeje antes de desenhar — R$ 62,90 — Aulas 4–5 COMPLETE

4. **Defina oferta, público e ação principal** (`oferta-publico-acao-principal`) — PAID R$ 34,90 · NOT_FOR_SALE · COMPLETE  
   Resultado: Brief de conversão da minha landing page · Tool: `CONVERSION_PAGE_BRIEF_V1`  
   O `LandingPageProject` nasce nesta aula. A estratégia canônica fica em `draftDocument.strategy.brief`. O `LessonResult` guarda só o resumo. Status do projeto permanece `DRAFT`. Nenhuma seção é gerada.
5. **Planeje a jornada do visitante** (`jornada-do-visitante`) — PAID R$ 34,90 · NOT_FOR_SALE · COMPLETE  
   Resultado: Mapa de decisão do visitante · Tool: `VISITOR_DECISION_JOURNEY_V1`  
   Cria `draftDocument.strategy.decisionJourney` no mesmo projeto. A navegação da aula é independente; a ferramenta exige o brief da Aula 4. `buildWireframeContextFromLandingPageProject` passa a montar o `WireframeContextV1`. A Aula 6 consome esse contexto. Esta aula não gera seções.

### Módulo 3 — Estruture e comunique — R$ 71,90 — Aulas 6–7 COMPLETE

6. **Monte a estrutura da sua landing page** (`organize-as-secoes-da-pagina`) — PAID R$ 39,90 · NOT_FOR_SALE · COMPLETE  
   Resultado: Estrutura da minha landing page · Tool: `LANDING_PAGE_WIREFRAME_V1`  
   Aula 4 grava `strategy.brief`. Aula 5 grava `strategy.decisionJourney`. Aula 6 grava `strategy.wireframe` e materializa `draftDocument.sections` com conteúdo provisório (`PLACEHOLDER`). O status passa a `READY_TO_PREVIEW`, que significa apenas que existe uma estrutura válida para visualizar. Não significa pronta para publicar.
7. **Escreva uma mensagem que deixa sua oferta clara** (`mensagem-que-deixa-a-oferta-clara`) — PAID R$ 39,90 · NOT_FOR_SALE · COMPLETE  
   Resultado: Copy da minha landing page · Tool: `LANDING_PAGE_COPY_ASSIST_V1`  
   Aula 6 deixa as seções em `PLACEHOLDER`. Aula 7 escreve e aprova a copy das seções principais (`HERO` e, quando existem, `PROBLEM`, `SOLUTION`, `BENEFITS`, `CTA`). A IA sugere por seção, no máximo 3 opções, e não grava sozinha. O aluno aplica como `DRAFT` e aprova. Fatos complementares ficam em `strategy.copyFacts`. Seções opcionais (`PROCESS`, `FAQ`, `TRUST`, `FORM`) não bloqueiam a conclusão quando faltam fatos. `CONTACT` e `FOOTER` não usam IA. O projeto permanece `READY_TO_PREVIEW`. O `LessonResult` guarda o resumo, não a copy inteira.

### Módulo 4 — Atenção e confiança — R$ 62,90 — Aulas 8–9 COMPLETE

8. **Use hierarquia visual para conduzir a atenção** (`hierarquia-visual-e-atencao`) — PAID R$ 34,90 · NOT_FOR_SALE · COMPLETE  
   Resultado: Direção visual da minha landing page · Tool: `LANDING_PAGE_VISUAL_DIRECTION_V1`  
   Aula 6 define a estrutura. Aula 7 define a mensagem. Aula 8 grava o tema, os ajustes visuais das seções e `strategy.visualDirection` no mesmo projeto, numa única revisão. O tema padrão pode ser confirmado sem personalização obrigatória. Contraste crítico não é salvo. O projeto permanece `READY_TO_PREVIEW`. O `LessonResult` guarda o resumo e a impressão digital do tema, não a paleta inteira.
9. **Construa confiança antes de pedir a ação** (`construa-confianca`) — PAID R$ 34,90 · NOT_FOR_SALE · COMPLETE  
   Resultado: Plano de confiança da minha landing page · Tool: `LANDING_PAGE_TRUST_V1`  
   A aula usa o núcleo da Phase 6. As provas continuam em `strategy.copyFacts.trustProofs` e a mídia em `LandingPageMedia`. `strategy.trustPlan` guarda só a decisão pedagógica: versão, tipos revisados, ids selecionados, uso das seções, tipos ausentes e próximos passos. Não duplica o texto das provas. O aluno pode concluir sem provas prontas. Depoimento sem autorização não fica pronto. Não há nota de confiança nem selo de verificado. O projeto permanece `READY_TO_PREVIEW`. O `LessonResult` guarda contagens, não o conteúdo.

### Módulo 5 — Publique, meça e melhore — R$ 103,90 — Aula 10 COMPLETE · Aulas 11–12 SCAFFOLDED

10. **Prepare sua página para o celular e uma boa experiência** (`pagina-mobile-e-experiencia`) — PAID R$ 34,90 · NOT_FOR_SALE · COMPLETE  
    Resultado: Revisão de experiência da minha landing page · Tool: `LANDING_PAGE_EXPERIENCE_REVIEW_V1`  
    A aula usa o núcleo da Phase 7. A revisão canônica fica em `draftDocument.experienceReview`. `strategy.experienceReview` guarda versão, status, viewports e contagens, sem o texto dos findings. A conclusão exige `READY_FOR_NEXT_STEP`. Salvar grava `reviewedDraftRevision` como a revisão seguinte do rascunho, então a própria gravação não deixa o status `STALE`. O projeto permanece `READY_TO_PREVIEW`. O `LessonResult` só é gravado quando a revisão está pronta.
11. **Configure o que precisa ser medido** (`mensuracao-da-pagina`) — PAID R$ 39,90 · NOT_FOR_SALE · SCAFFOLDED  
    Resultado planejado: Mapa de mensuração aplicado ao projeto · Tool planejada: `LANDING_PAGE_MEASUREMENT_V1`  
    O núcleo da Phase 8 já existe: ação, formulário, lead e contagem diária. A aula ainda não foi produzida. Não há rota pública nem publicação da landing.
12. **Revise e publique sua landing page** (`revisao-antes-do-trafego`) — PAID R$ 39,90  
    Resultado: Landing page publicada · Tool: `LANDING_PAGE_PUBLISH_V1`  
    Slug estável mantido; título e papel reframeados para publicação real.

## Resultado macro

`LandingPageProject` — página que o aluno constrói ao longo das aulas 4–12.  
Relação opcional com `Project` genérico (1 Project → N landing pages).  
`LessonResult` continua por aula para progresso/histórico; o projeto de página é a fonte central da construção.

## Deploy

`deploySitesCourseScaffold` + seeds das aulas 1–10 quando `catalog:deploy` for executado. O comando não foi executado nesta etapa. Course permanece DRAFT até decisão explícita de release.
