# Aquisição educacional e SEO das aulas

A home apresenta o aprendizado em tráfego pago como oferta principal. A marca continua pessoal: Alexandre Feio ensina e, para quem prefere delegar, também faz a gestão.

A hierarquia é aprender, aplicar no próprio negócio, comprar aula, módulo ou curso quando a venda existir, e contratar a gestão. `/trafego-pago` continua sendo a página comercial do serviço. Ela não foi desmontada.

`COMMERCE_ENABLED` permanece desligado. Nenhuma aula está `AVAILABLE`.

## Preview público

Uma aula paga publicada pode expor blocos marcados com `LessonBlock.isPublicPreview`. A escolha é por `blockKey`. Não se usa posição nem porcentagem.

Nesta fase os tipos permitidos são `HEADING`, `TEXT`, `CALLOUT` e `EXAMPLE`. `TOOL`, `RESULT`, `ACTIVITY`, `CHECKPOINT`, `CHECKLIST`, `CONCLUSION` e `IMAGE` são recusados no editor e também filtrados na consulta.

Quem não tem entitlement recebe, no servidor, metadados e somente esses blocos. O corpo protegido não é buscado para esconder no cliente. Quem tem entitlement recebe o leitor completo, com progresso, notas, marcações e ferramentas. A pré-visualização de admin continua carregando tudo, sem gravar progresso e sem evento de aquisição. Ela não tem canonical público.

Aulas 4, 5 e 6 marcam a amostra no seed:

- Aula 4: até a explicação do objetivo de negócio, antes do primeiro checkpoint.
- Aula 5: introdução, destino e o primeiro exemplo.
- Aula 6: introdução e a hierarquia básica da Pesquisa.

Aulas 7–12 permanecem sem blocos e sem amostra. O texto de `publicPreview` sozinho não as indexa.

## Indexação

Aula gratuita publicada com corpo: `index, follow`, texto completo no HTML, sem login, no sitemap, canonical própria.

Aula paga publicada com amostra válida: `index, follow`. Google e o visitante recebem a mesma amostra. Não há conteúdo especial para Googlebot.

Rascunho e aula paga sem amostra útil: `noindex`, fora do sitemap. Não se publica página fina só com “em preparação” para indexar.

A prontidão de SEO é separada da prontidão editorial. Faltar amostra não impede publicar o documento; impede indexar a aula paga.

## Paywall

A amostra termina e a região `.lesson-paywall` começa. Enquanto o produto está `NOT_FOR_SALE`, ou o comércio está desligado, a página diz que o conteúdo completo fica disponível em breve. Não há botão de compra.

Quando o comércio estiver ligado e o status for `AVAILABLE`, o mesmo componente pode mostrar a compra da aula, do módulo e do curso com o preço vindo do cadastro.

## Dados estruturados

Aula indexável: `Article` e `LearningResource`, com autor Alexandre Feio. Gratuita: `isAccessibleForFree: true`. Paga: `false`, e `hasPart` aponta para `.lesson-paywall` somente quando essa região está na página.

Breadcrumb visual e `BreadcrumbList`: Home, curso, aula.

A página do curso usa `Course` com nome, descrição e provider. Não há `Offer`, avaliação nem FAQ em JSON-LD.

## Sitemap e canonical

O sitemap inclui a home, o curso publicado, aulas gratuitas publicadas, aulas pagas com amostra, `/trafego-pago` e as páginas públicas já previstas. Ficam de fora `/app`, `/admin`, autenticação privada, rascunho, pré-visualização, checkout e aula sem amostra.

`lastModified` usa a data real do registro. Canonical é `https://alexandrefeio.com.br/<rota>`, sem `www` e sem query string. A pré-visualização de admin não define canonical da aula pública.

## Analytics

Eventos novos, sem dados pessoais e sem resultado de aula, projeto, diagnóstico, resposta ou orçamento:

- `course_view`
- `course_free_start`
- `lesson_public_preview_view`
- `lesson_paywall_view`
- `course_cta_click`
- `service_from_course_click`

Os parâmetros aceitos são `course_slug`, `lesson_slug` e `cta_name`. Visualizações repetidas na mesma aba não disparam de novo. O paywall só dispara quando entra na viewport. A pré-visualização de admin não dispara esses eventos.

## Editorial daqui para frente

No admin, o bloco de texto, título, callout ou exemplo pode ser marcado como “Disponível no preview público”. Os outros tipos não. Uma aula paga só fica pronta para SEO quando tiver ao menos um desses blocos marcados. As aulas 7–12 não recebem conteúdo nem amostra automaticamente.

## Search Console, depois do deploy

Confirmar HTTP 200 das três aulas gratuitas. Nas aulas 4, 5 e 6, confirmar HTTP 200, amostra visível e ausência do corpo protegido no HTML sem entitlement. Conferir title, description, canonical, JSON-LD, sitemap e robots.

Pedir indexação manual destas URLs. Não usar a Indexing API para páginas comuns.

- https://alexandrefeio.com.br/
- https://alexandrefeio.com.br/cursos/trafego-pago-na-pratica
- https://alexandrefeio.com.br/aulas/como-funciona-o-trafego-pago
- https://alexandrefeio.com.br/aulas/google-ads-ou-meta-ads
- https://alexandrefeio.com.br/aulas/negocio-pronto-para-anunciar
- https://alexandrefeio.com.br/aulas/objetivo-oferta-orcamento
- https://alexandrefeio.com.br/aulas/destino-e-mensuracao
- https://alexandrefeio.com.br/aulas/campanha-de-pesquisa
- https://alexandrefeio.com.br/trafego-pago
