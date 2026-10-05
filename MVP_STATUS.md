# Estado do MVP

Este arquivo existe para impedir que conteúdo fictício seja publicado como informação verdadeira.

## IMPLEMENTADO

- Landing page de Alexandre Feio em Next.js (App Router), TypeScript e Tailwind CSS
- Header com navegação, CTA e menu mobile
- Seções: hero, problema, proposta, ofertas, diferenciais, CTA intermediário, processo, resultados, sobre, FAQ, CTA final e footer
- Formulário com validação, loading simulado e estado de sucesso
- Seleção de oferta levando ao formulário (`?servico=`)
- CTAs preparados para WhatsApp, sem abrir número placeholder
- Tokens de cor centralizados
- SEO: title, description, Open Graph, canonical, robots e sitemap
- Abstração `trackEvent` para analytics futuro
- Cases mockados permanecem no código e ficam fora da página enquanto `isMock` for verdadeiro

## MOCKADO

- WhatsApp: `{{WHATSAPP}}`
- E-mail: `{{EMAIL}}`
- Instagram: `{{INSTAGRAM}}`
- Domínio canônico: `https://seudominio.com.br`
- Métricas do hero (visitantes, conversões, leads, custo por lead)
- Cases em `src/data/cases.ts` (`isMock: true`)
- Envio do formulário (nenhum dado sai do navegador)
- Foto profissional (espaço reservado, sem imagem)
- Preços (não há valor publicado)

## PENDENTE

- WhatsApp real
- E-mail real
- Instagram real
- Analytics
- Conversão do Google Ads
- Meta Pixel
- Formulário real
- Domínio
- Cases reais
- Fotografia profissional
- Política de privacidade
- Termos, quando a página passar a coletar dados
- Preços, se forem publicados
