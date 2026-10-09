# Alexandre Feio

Landing page de Alexandre Feio: sites e tráfego pago para empresas que querem gerar oportunidades.

O formulário envia o contato por e-mail. Não há banco de dados.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Resend
- ESLint

## Como executar

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env.local` a partir de `.env.example`.
3. Preencha `RESEND_API_KEY` com a chave da conta Resend.
4. Confirme `CONTACT_TO_EMAIL`, o endereço que recebe os contatos.
5. Preencha `CONTACT_FROM_EMAIL` com um remetente autorizado na conta Resend. O remetente pretendido, depois da verificação do domínio, é `Alexandre Feio <contato@alexandrefeio.com.br>`.
6. Confirme `CONTACT_REPLY_TO_EMAIL`. A confirmação enviada ao lead usa esse endereço como resposta.
7. Suba o site:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

8. Para testar o formulário, preencha nome, empresa, WhatsApp, e-mail e objetivo na seção de contato. O envio só conclui quando as variáveis estão corretas e o Resend aceita o remetente. Alexandre recebe o contato. O lead recebe a confirmação em seguida.
9. Opcional: preencha `NEXT_PUBLIC_GTM_ID` para carregar o Google Tag Manager.

Outros comandos:

```bash
npm run lint
npm run typecheck
npm run build
npm start
```

## Estrutura

```text
src/
  app/                  rotas, metadata, robots, sitemap e a ação de envio
  app/privacidade/      política curta do formulário
  components/layout/    header, menu mobile e footer
  components/sections/  seções da landing
  components/ui/        container, links e heading
  data/                 conteúdo e configuração pública
  lib/                  validação do contato, WhatsApp e analytics
```

## Onde alterar

| O que mudar | Arquivo |
| --- | --- |
| Nome, WhatsApp, e-mail público, Instagram, domínio, CTAs | `src/data/site-config.ts` |
| Chave e remetente do formulário | `.env.local` |
| Cores e tokens | `src/app/globals.css` |
| Serviços | `src/data/services.ts` |
| Cases | `src/data/cases.ts` |
| FAQ | `src/data/faq.ts` |
| Objetivos do formulário | `src/data/lead-objectives.ts` |

CTAs gerais abrem o formulário. "Quero conversar" abre o WhatsApp.

## Mensuração

1. Configure `NEXT_PUBLIC_GTM_ID` no `.env.local`.
2. Crie o container no Google Tag Manager.
3. Configure GA4, triggers e conversões no GTM — não no código.
4. Use o evento `generate_lead` como conversão principal.
5. Configure Google Ads e Meta Pixel no GTM, respeitando consentimento de marketing.
6. Teste no Preview do GTM e no DebugView do GA4.

Guia detalhado: `docs/analytics-setup.md`.

Scripts de verificação:

```bash
npx --yes tsx scripts/check-analytics.ts
npx --yes tsx scripts/check-lead.ts
```

## Ainda demonstrativo

- Cases, enquanto `isMock` for verdadeiro

O detalhe está em `MVP_STATUS.md`.

## Plataforma

A auditoria e a arquitetura da V1 estão em `docs/platform/`. O site publicado continua sem banco, sem conta de aluno e sem área de curso.
