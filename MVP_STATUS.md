# Estado do MVP

Este arquivo existe para impedir que conteúdo fictício seja publicado como informação verdadeira.

## IMPLEMENTADO

- Landing page de Alexandre Feio em Next.js (App Router), TypeScript e Tailwind CSS
- Header, menu mobile, seções da página e footer
- WhatsApp real, e-mail público e Instagram
- Domínio `https://alexandrefeio.com.br` no código (metadata, canonical, Open Graph, sitemap e robots)
- Formulário com validação no navegador e no servidor, envio por e-mail e estados de envio, sucesso e erro
- Página `/privacidade`
- Seleção de oferta levando ao formulário (`?servico=`)
- CTAs gerais abrem o formulário; "Quero conversar" abre o WhatsApp
- Abstração `trackEvent`, incluindo `form_success`
- Cases mockados permanecem no código e ficam fora da página enquanto `isMock` for verdadeiro

## MOCKADO

- Cases em `src/data/cases.ts` (`isMock: true`)
- Foto profissional (espaço reservado, sem imagem)
- Preços (não há valor publicado)

## PENDENTE

- Fotografia profissional
- Cases reais
- Preços, se forem publicados
- Analytics
- Conversão do Google Ads
- Meta Pixel
- Ajustes finais da política de privacidade, se o uso dos dados mudar
- Publicação e DNS de `alexandrefeio.com.br` (a URL no código não significa que o domínio já aponta para este site)
- Verificação do domínio no provedor de e-mail e remetente de produção
