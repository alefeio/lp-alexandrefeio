# Sites que Convertem — corte de lançamento

O curso permanece DRAFT, fora do público e NOT_FOR_SALE. Este documento não liga o runtime, não publica o curso e não escolhe política comercial.

## TECHNICAL READY

Pronto no código, com o runtime de produção ainda desligado:

- Limitador durável de copy, upload, formulário e evento público. O balde fica no Postgres. O teste isolado usa a mesma interface em memória.
- Formulário público com tipo de conteúdo, tamanho máximo, honeypot, idempotência e limitador por publicação e visitante.
- Evento público restrito a `PAGE_VIEW`, `CTA_CLICK`, `WHATSAPP_CLICK` e `FORM_START`. `FORM_SUBMIT` só nasce no servidor, depois do lead.
- Chave de abuso efêmera. Endereço bruto não é gravado e não vira identificador de analytics.
- Limpeza técnica de mídia órfã, com simulação por omissão e proteção de publicação histórica. A APIMG não oferece exclusão física no contrato observado, então a limpeza de arquivo remoto fica bloqueada.
- Cabeçalhos públicos e rota `/p/[slug]` fora do GTM da plataforma, com `noindex`.
- Validador `evaluateLandingPagePublicReleaseReadiness`. Ele não imprime segredo.
- Mídia pública da landing page usa a APIMG no servidor. O Vercel Blob não é requisito dessa mídia. Planilhas de campanha continuam no armazenamento privado existente.

`LIVE_MEDIA_STORE_READY` só fica verdadeiro depois de upload e leitura sintéticos na APIMG. A exclusão física continua sem suporte.

## POLICY DECISIONS

Ainda sem decisão do proprietário. Não foram escolhidas nesta etapa:

- Duração da retenção de leads.
- Retenção de mídia depois de despublicar ou encerrar a conta.
- Duração da retenção das contagens diárias.
- CAPTCHA no lançamento. O código trata como desnecessário para o MVP enquanto honeypot, limitador, validação e idempotência estiverem ativos. Pode ser revisto se o abuso aparecer.
- Cota comercial de gerações de copy.
- Direito de hospedagem depois da compra do curso.
- Quantidade de páginas por usuário.
- Cota de armazenamento e limite comercial de mídia.

A página `/privacidade` precisa ser atualizada antes de receber leads públicos. O texto atual não cobre formulário de landing, acesso do dono aos leads, contagens agregadas de primeira parte, mídia pública nem retenção ainda indefinida.

## MANUAL RELEASE STEPS

1. Definir as políticas acima e atualizar `/privacidade`.
2. Confirmar `LANDING_PAGE_RATE_LIMIT_SECRET` no servidor, com pelo menos 32 caracteres. Sem prefixo público.
3. Confirmar `APIMG_UPLOAD_URL` e `APIMG_API_KEY` no servidor e o smoke sintético de upload e leitura. A exclusão física da APIMG não existe no contrato observado.
4. Aplicar a migration aditiva se ainda não estiver no banco de produção.
5. Só então avaliar `LANDING_PAGE_PUBLIC_RUNTIME_ENABLED=true` em produção.
6. Smoke da rota pública real, ainda com `noindex`.
7. Decidir catálogo e commerce do curso. `catalog:deploy` não faz parte deste corte técnico.
