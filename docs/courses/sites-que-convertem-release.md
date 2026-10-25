# Sites que Convertem — corte de lançamento

O curso permanece DRAFT, fora do público e NOT_FOR_SALE. Este documento não liga o runtime, não publica o curso e não escolhe política comercial.

## TECHNICAL READY

Pronto no código, com o runtime de produção ainda desligado:

- Limitador durável de copy, upload, formulário e evento público. O balde fica no Postgres. O teste isolado usa a mesma interface em memória.
- Formulário público com tipo de conteúdo, tamanho máximo, honeypot, idempotência e limitador por publicação e visitante.
- Evento público restrito a `PAGE_VIEW`, `CTA_CLICK`, `WHATSAPP_CLICK` e `FORM_START`. `FORM_SUBMIT` só nasce no servidor, depois do lead.
- Chave de abuso efêmera. Endereço bruto não é gravado e não vira identificador de analytics.
- Limpeza técnica de mídia órfã, com simulação por omissão e proteção de rascunho, publicação ativa, publicação histórica e snapshot de rollback. A exclusão física usa `DELETE /v1/images/{public_id}` na APIMG.
- Cabeçalhos públicos e rota `/p/[slug]` fora do GTM da plataforma, com `noindex`.
- Validador `evaluateLandingPagePublicReleaseReadiness`. Ele não imprime segredo.
- Mídia pública da landing page usa a APIMG no servidor. O Vercel Blob não é requisito dessa mídia. Planilhas de campanha continuam no armazenamento privado existente.

`LIVE_MEDIA_STORE_READY=true` depois do smoke sintético de upload, leitura pública, exclusão e leitura 404. A segunda exclusão é idempotente.

## POLICY DECISIONS

Privacidade e retenção da landing page, V1:

- `PRIVACY_POLICY`: FINALIZED. A página `/privacidade` cobre formulário de landing, campos variáveis, acesso só do responsável, métricas agregadas, mídia pública, limite com a OpenAI e analytics de terceiros.
- `LEAD_RETENTION`: 12 months, a partir de `createdAt`, depois exclusão. Arquivar não renova.
- `METRICS_RETENTION`: 24 months, a partir de `date`, depois exclusão da linha agregada.
- `MEDIA_RETENTION`: referenced/historical retained; unreferenced follows orphan cleanup.
- `CAPTCHA`: NOT_REQUIRED_FOR_MVP.
- `VISITOR_DATA_TO_OPENAI`: NO.
- `THIRD_PARTY_ANALYTICS_ON_STUDENT_PAGES`: NONE_BY_DEFAULT.

Ainda sem decisão comercial. Não foram escolhidas nesta etapa:

- Cota comercial de gerações de copy.
- Direito de hospedagem depois da compra do curso.
- Quantidade de páginas por usuário.
- Cota de armazenamento e limite comercial de mídia.
- Limite comercial de leads.
- Domínio próprio e exportação de código.

## MANUAL RELEASE STEPS

1. O deploy leva `GET /api/cron/landing-retention` às 04:00 UTC. Sem `CRON_SECRET`, a rota responde 503. O comando local `npm run landing:retention` continua só contando, sem `--execute`.
2. Confirmar `LANDING_PAGE_RATE_LIMIT_SECRET` no servidor, com pelo menos 32 caracteres. Sem prefixo público.
3. Confirmar no servidor `APIMG_UPLOAD_URL`, `APIMG_API_KEY`, `APIMG_UPLOAD_FOLDER=alexandre-feio/uploads` e `APIMG_SITE_UPLOAD_FOLDER=alexandre-feio/site`. As pastas não vão no POST. O smoke sintético cobre upload, leitura, exclusão e a leitura 404.
4. Aplicar a migration aditiva se ainda não estiver no banco de produção.
5. Só então avaliar `LANDING_PAGE_PUBLIC_RUNTIME_ENABLED=true` em produção.
6. Smoke da rota pública real, ainda com `noindex`.
7. Decidir catálogo e commerce do curso. `catalog:deploy` não faz parte deste corte técnico.
