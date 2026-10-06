# Estado do MVP

Este arquivo existe para impedir que conteúdo fictício seja publicado como informação verdadeira.

## IMPLEMENTADO

- Landing page de Alexandre Feio em Next.js (App Router), TypeScript e Tailwind CSS
- Header, menu mobile, seções da página e footer
- WhatsApp real, e-mail público e Instagram
- Domínio `https://alexandrefeio.com.br` no código (metadata, canonical, Open Graph, sitemap e robots)
- Formulário com nome, empresa, WhatsApp, e-mail e objetivo, validado no navegador e no servidor
- Envio administrativo e confirmação ao lead no servidor: a confirmação só parte depois que o e-mail para Alexandre é aceito; se a confirmação falhar, o contato continua recebido
- Página `/privacidade`
- Seleção de oferta levando ao formulário (`?servico=`)
- CTAs gerais abrem o formulário; "Quero conversar" abre o WhatsApp
- Camada de mensuração com `dataLayer`, consentimento, atribuição de campanha e evento `generate_lead`
- Página `/obrigado` com `noindex`
- Cases mockados permanecem no código e ficam fora da página enquanto `isMock` for verdadeiro
- Fotografia profissional em `public/alexandre.jpg`

## MOCKADO

- Cases em `src/data/cases.ts` (`isMock: true`)
- Preços (não há valor publicado)

## PENDENTE

- Cases reais
- Preços, se forem publicados
- Container GTM publicado com `NEXT_PUBLIC_GTM_ID` em produção
- GA4 conectado no GTM e conversão `generate_lead` validada
- Google Ads e Meta Pixel configurados no GTM com consentimento
- Ajustes finais da política de privacidade, se o uso dos dados mudar
- Publicação e DNS de `alexandrefeio.com.br` (a URL no código não significa que o domínio já aponta para este site)
- Teste real do envio: nesta máquina não há `.env.local`, então o Resend não foi chamado
- Verificação de `contato@alexandrefeio.com.br` no Resend e remetente autorizado em `CONTACT_FROM_EMAIL`
- Variáveis na Vercel: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` e `CONTACT_REPLY_TO_EMAIL`
