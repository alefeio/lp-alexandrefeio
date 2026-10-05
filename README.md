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
5. Preencha `CONTACT_FROM_EMAIL` com um remetente aceito pela conta Resend. Exemplo, depois que o domínio estiver verificado: `Alexandre Feio <contato@alexandrefeio.com.br>`.
6. Suba o site:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

7. Para testar o formulário, preencha nome, empresa, WhatsApp e objetivo na seção de contato. O envio só conclui quando as três variáveis estão corretas e o Resend aceita o remetente.

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

## Ainda demonstrativo

- Métricas do hero
- Cases, enquanto `isMock` for verdadeiro
- Foto profissional

O detalhe está em `MVP_STATUS.md`.
