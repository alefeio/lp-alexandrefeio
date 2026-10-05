# Site profissional — MVP

Landing page para validar posicionamento, oferta e conversão de um profissional que cria sites e estrutura tráfego pago. O objetivo do trabalho é gerar oportunidades de negócio, não vender “marketing digital” genérico.

Neste ciclo existe apenas o front-end. Não há backend, banco, envio real de formulário nem integrações.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Lucide Icons
- ESLint

## Como executar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

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
  app/                  rotas, metadata, robots, sitemap, ícone e Open Graph
  components/layout/    header, menu mobile e footer
  components/sections/  seções da landing
  components/ui/        container, links e heading
  data/                 conteúdo e configuração
  lib/                  analytics, WhatsApp e estilos de botão
  types/                tipos do conteúdo
```

## Onde alterar

| O que mudar | Arquivo |
| --- | --- |
| Nome, WhatsApp, e-mail, Instagram, domínio, CTAs | `src/data/site-config.ts` |
| Cores e tokens | `src/app/globals.css` |
| Serviços | `src/data/services.ts` |
| Cases | `src/data/cases.ts` |
| FAQ | `src/data/faq.ts` |
| Processo | `src/data/process.ts` |
| Textos das seções, métricas ilustrativas | `src/data/home.ts` |
| Objetivos do formulário | `src/data/lead-objectives.ts` |
| Menu | `src/data/navigation.ts` |

Enquanto `contact.whatsapp` for um placeholder (`{{WHATSAPP}}`), os botões não abrem um telefone. Eles levam ao formulário. Com um número real, os CTAs gerais passam a abrir o WhatsApp com a mensagem definida em `contact.whatsappMessage`.

## Itens mockados

- E-mail, Instagram e WhatsApp (`{{...}}`)
- Domínio (`https://seudominio.com.br`)
- Métricas do hero
- Cases (existem no código, mas não são exibidos enquanto `isMock` for verdadeiro)
- Envio do formulário (`features.leadForm: "mock"`)
- Foto profissional (espaço vazio)

Não publique esses mocks como se fossem informações reais. O detalhe está em `MVP_STATUS.md`.

## Próximos passos

1. Trocar WhatsApp, e-mail, Instagram e domínio em `src/data/site-config.ts`.
2. Conectar o formulário a um envio real e mudar `features.leadForm` para `"live"`.
3. Publicar cases reais, adicionar a foto e incluir política de privacidade, analytics e pixels.
