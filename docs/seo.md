# SEO técnico — Alexandre Feio

## Domínio canônico

`https://alexandrefeio.com.br` (apex, sem `www`)

- `www.alexandrefeio.com.br` deve redirecionar permanentemente para o apex (configuração Vercel).
- `metadataBase`, canonical, Open Graph, sitemap, robots e JSON-LD usam apenas o apex.

## Rotas

| Rota | Indexável | Sitemap | Observação |
| --- | --- | --- | --- |
| `/` | Sim | Sim | Página principal |
| `/trafego-pago` | Sim | Sim | Landing de gestão de tráfego pago |
| `/privacidade` | Sim | Sim | Transparência; sem otimização de keyword |
| `/obrigado` | Não (`noindex, nofollow`) | Não | Confirmação pós-lead; não é conversão por pageview |

Query strings (`utm_*`, `gclid`, `fbclid`, `servico`) não alteram a canonical da home (`/`).

## Metadata

- **Title:** `Alexandre Feio | Sites e Tráfego Pago em Belém`
- **Description:** sites, landing pages e tráfego pago; Belém/PA e projetos no Brasil; sem promessas de resultado.
- Canonical definida por página (não herdada globalmente na home a partir de rotas internas).

## Structured data

JSON-LD com `@graph`:

- `WebSite` — site público
- `Person` — Alexandre Feio (marca pessoal)

Sem reviews, rating, endereço comercial, preço ou número de clientes.

## Robots

- `Allow: /`
- `Sitemap: https://alexandrefeio.com.br/sitemap.xml`
- `/obrigado` não depende de `Disallow`; usa `noindex` na página.

## Sitemap

`https://alexandrefeio.com.br/sitemap.xml`

Inclui `/`, `/trafego-pago` e `/privacidade`.

## Tracking

SEO não altera GTM, Consent Mode, eventos de negócio, Resend nem `/obrigado` como fluxo de lead.

## Search Console (passos externos)

Após o deploy:

1. Enviar sitemap: `https://alexandrefeio.com.br/sitemap.xml`
2. Reinspecionar `https://alexandrefeio.com.br/` se metadata/canonical/JSON-LD mudarem de forma relevante
3. Acompanhar cobertura e experiência na página; não é necessário revalidar propriedade (já verificada via DNS TXT)

## Futuras páginas (somente recomendação)

Só criar rotas como `/criacao-de-sites` ou `/trafego-pago` se houver intenção de busca própria, oferta distinta e conteúdo realmente diferente da home. Não criar páginas finas só para SEO. Ads pode ter landings próprias depois, sem obrigar a home a ser página de campanha.

## Imagem necessária (Open Graph)

A OG atual é gerada por código (`opengraph-image.tsx`) e é tecnicamente válida (1200×630). Não é a identidade visual definitiva.

Quando a marca estiver pronta, entregar um PNG/JPG:

| Item | Valor |
| --- | --- |
| Objetivo | Compartilhamento em redes e prévia no Google |
| Dimensões | 1200×630 px |
| Conteúdo | Logo da marca + benefício curto (presença digital → oportunidades) |
| Composição | Fundo limpo, logo legível, pouco texto, contraste alto |
| Texto sugerido | Nome “Alexandre Feio” + uma linha de oferta (sites e tráfego pago) |
| Evitar | Keyword stuffing, fake reviews, mockups genéricos de “agência”, endereço inventado |

Substituir depois o arquivo/gerador em `src/app/opengraph-image.tsx` sem mudar title/description.
