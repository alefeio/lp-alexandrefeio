# Sites que Convertem para Pequenos Negócios

## Status de produção

| Campo | Valor |
| --- | --- |
| CONTENT_STATUS | SCAFFOLDED |
| PUBLIC_RELEASE | NOT_APPROVED |
| COMMERCE_RELEASE | NOT_APPROVED |
| Publication | DRAFT |
| Commerce | NOT_FOR_SALE |
| Catálogo público | não |
| Sitemap / indexação | não |

Scaffold apenas: Course, módulos, aulas, ordem, slugs, durações, accessType, preços e estado editorial. Sem conteúdo definitivo de aula, sem Tool funcional, sem LessonResult e sem produto à venda.

## Proposta

Ensinar pequenos negócios, profissionais e empreendedores a planejar e estruturar páginas capazes de conduzir o visitante até uma ação real (contato, orçamento, agendamento, lead, compra ou outra conversão).

Não é curso de HTML, CSS, JavaScript, WordPress, Next.js ou programação.

É curso de estratégia de página, jornada, oferta, conversão, copy, estrutura, experiência, confiança e mensuração.

Princípio pedagógico: Entender → Diagnosticar → Planejar → Estruturar → Comunicar → Validar → Medir.

## Público

Pequenos negócios, profissionais e empreendedores que precisam de páginas mais claras e orientadas à conversão, sem depender de implementação técnica nesta trilha.

## Identidade

- **Título:** Sites que Convertem para Pequenos Negócios
- **Slug:** `sites-que-convertem`
- **Subtítulo:** Aprenda a planejar páginas mais claras, confiáveis e orientadas à conversão — aplicando cada etapa no seu próprio negócio.
- **Ordem no catálogo editorial:** depois de `trafego-pago-na-pratica` (`sortOrder: 1`)
- **Totais:** 12 aulas · 5 módulos · 3 aulas gratuitas
- **Preço planejado do curso completo:** R$ 249,90

## Preços planejados

Soma das aulas pagas individuais: **R$ 334,10**  
Soma dos módulos pagos: **R$ 301,60**  
Curso completo: **R$ 249,90** (economia planejada R$ 84,20 / ~25,2% — não exibir publicamente ainda)

Nenhum produto deste curso fica `AVAILABLE` neste estágio.

## Módulos e aulas

### Módulo 1 — Antes de construir (gratuito / introdutório)

Sem preço de bundle.

1. **Seu site realmente ajuda a vender?** (`site-ajuda-a-vender`) — 25 min — FREE  
   Resultado planejado: Meu mapa de conversão · Tool planejada: `CONVERSION_JOURNEY_MAP_V1`
2. **Site, landing page ou WhatsApp: o que seu negócio precisa?** (`site-landing-page-ou-whatsapp`) — 25 min — FREE  
   Resultado planejado: Minha estrutura digital ideal · Tool planejada: `DIGITAL_PRESENCE_DECISION_V1`
3. **Sua página está pronta para converter?** (`pagina-pronta-para-converter`) — 25 min — FREE  
   Resultado planejado: Diagnóstico de prontidão da página · Tool planejada: `CONVERSION_PAGE_READINESS_V1`

### Módulo 2 — Planeje antes de desenhar — R$ 62,90

4. **Defina oferta, público e ação principal** (`oferta-publico-acao-principal`) — 30 min — PAID R$ 34,90  
   Resultado planejado: Brief da página · Tool planejada: `CONVERSION_PAGE_BRIEF_V1`
5. **Planeje a jornada do visitante** (`jornada-do-visitante`) — 30 min — PAID R$ 34,90  
   Resultado planejado: Minha jornada de conversão · Tool planejada: `VISITOR_JOURNEY_PLAN_V1`

### Módulo 3 — Estruture e comunique — R$ 71,90

6. **Organize as seções da página** (`organize-as-secoes-da-pagina`) — 35 min — PAID R$ 39,90  
   Resultado planejado: Estrutura da minha página · Tool planejada: `CONVERSION_PAGE_STRUCTURE_V1`
7. **Escreva uma mensagem que deixa sua oferta clara** (`mensagem-que-deixa-a-oferta-clara`) — 35 min — PAID R$ 39,90  
   Resultado planejado: Plano de copy da página · Tool planejada: `CONVERSION_COPY_PLAN_V1`

### Módulo 4 — Atenção e confiança — R$ 62,90

8. **Use hierarquia visual para conduzir a atenção** (`hierarquia-visual-e-atencao`) — 30 min — PAID R$ 34,90  
   Resultado planejado: Direção visual da página · Tool planejada: `PAGE_VISUAL_DIRECTION_V1`
9. **Construa confiança antes de pedir a ação** (`construa-confianca`) — 30 min — PAID R$ 34,90  
   Resultado planejado: Plano de confiança e prova · Tool planejada: `TRUST_PROOF_PLAN_V1`

### Módulo 5 — Publique, meça e melhore — R$ 103,90

10. **Prepare sua página para o celular e uma boa experiência** (`pagina-mobile-e-experiencia`) — 30 min — PAID R$ 34,90  
    Resultado planejado: Checklist de experiência da página · Tool planejada: `PAGE_EXPERIENCE_CHECKLIST_V1`
11. **Configure o que precisa ser medido** (`mensuracao-da-pagina`) — 35 min — PAID R$ 39,90  
    Resultado planejado: Plano de mensuração da página · Tool planejada: `PAGE_MEASUREMENT_PLAN_V1`
12. **Revise sua página antes de trazer tráfego** (`revisao-antes-do-trafego`) — 35 min — PAID R$ 39,90  
    Resultado planejado: Diagnóstico final da página · Tool planejada: `CONVERSION_PAGE_FINAL_REVIEW_V1`

## Tools e resultados

Os nomes de Tool e de resultado são **planejamento editorial**. Não estão registrados como Tools funcionais nem como `LessonResult` no banco. Só passam a existir quando a aula definitiva for implementada.

## Seed / deploy

- Definição: `src/lib/learning/sites-course.ts`
- Deploy idempotente: `deploySitesCourseScaffold()` em `catalog-deploy.ts`, chamado por `db:seed` / `catalog:deploy`
- Upsert por slug; reexecutar não duplica curso/módulo/aula
- Mantém `DRAFT` + `NOT_FOR_SALE` + `publishedAt: null`
- Não cria blocos de conteúdo

## Upgrade credit

Usa a mesma infraestrutura futura de Order / OrderItem / Entitlement já existente no curso 1. Nenhuma regra financeira nova nesta tarefa. Nenhum produto habilitado.

## Próximo passo

Conteúdo definitivo da Aula 1 — fora do escopo deste scaffold.
