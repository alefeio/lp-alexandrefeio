# Arquitetura proposta

A Sprint 1 separou os layouts em route groups sem mudar as URLs públicas.

| Grupo | URLs |
| --- | --- |
| `(public)` | `/`, `/trafego-pago`, `/privacidade`, `/obrigado` |
| `(auth)` | `/entrar`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`, `/verificar-email` |
| `(app)` | `/app` |
| `(admin)` | `/admin` |

O layout raiz guarda fonte, GTM e consentimento. O header comercial fica só no grupo público. `/app` e `/admin` são `noindex` e estão fora do sitemap.

O desenho abaixo continua valendo para curso, aula e pagamento, que ainda não existem.

## Premissa que o código corrige

A V1 não nasce de um CMS nem de um banco já ligado ao site. Nasce da landing atual. A plataforma é uma área nova no mesmo domínio, não um segundo produto visual.

## Limites

- Um curso inicial: “Tráfego Pago na Prática para Pequenos Negócios”.
- `Course` existe para não impedir um segundo curso, sem painel de catálogo amplo.
- Aula é a unidade de acesso, de progresso e de compra avulsa.
- Módulo e curso são pacotes que concedem várias aulas.
- Vídeo fica fora da V1.
- Admin da V1 é operacional e mínimo: publicar conteúdo, preço, ver alunos e pedidos.

## Áreas

| Área | Quem vê | Layout |
| --- | --- | --- |
| Marketing | Público | Header, footer e CTAs atuais |
| Conteúdo público | Público e crawler, só o que for publicado como vitrine | Mesma identidade, metadata própria |
| Aluno | Sessão | Sem o header comercial da home |
| Admin | Sessão com papel admin | Ferramenta, não landing |

Rotas futuras, não criadas agora:

- `/cursos` e página do curso: vitrine indexável.
- `/aulas/[slug]`: aula. Trecho público pode ser indexável; corpo comprado não.
- `/app`: projetos, progresso, tarefas.
- `/app/projetos/[id]`: projeto do aluno.
- `/app/analisar`: upload privado e análise, quando existirem.
- `/admin`: conteúdo, preços, publicação, alunos, pedidos.

## App Router

Hoje `src/app/layout.tsx` é global. A área `/app` não deve herdar o header de captação. O caminho é um route group `(marketing)` para as rotas atuais e outro para a área logada. Fazer isso só na sprint que criar a primeira rota autenticada.

Server Components por padrão. Client Components só onde já são necessários (formulário, consentimento, menu) ou onde a aula exigir interação. Server Actions para mutações do aluno. Não criar API pública paralela sem necessidade.

Não há middleware hoje. Quando houver sessão, o middleware só protege `/app` e `/admin`. Não deve interferir em `/`, `/trafego-pago`, consentimento ou no envio do lead.

## SEO das páginas futuras

- Canonical no apex, como em `docs/seo.md`.
- Sitemap: só vitrines públicas (curso, módulo e aula marcada como gratuita ou com resumo público).
- Aula paga: `noindex` no corpo, ou página indexável apenas com título, descrição e convite, sem os blocos pagos no HTML.
- `/app` e `/admin`: `noindex` e fora do sitemap.
- JSON-LD de curso só com dados reais. Sem preço inventado, review ou nota.

## Design system

Reutilizar, sem paleta nova:

- Cores e tipo em `src/app/globals.css` (`--background`, `--ink`, `--cta`, `--accent`, `--danger`).
- `Container`, `Section`, `SectionHeading`.
- `buttonClass` em `src/lib/button-styles.ts`.
- Formulários no padrão de `LeadForm` (rótulo, erro, foco visível).
- Tema claro. `colorScheme: light`. Não há tema escuro.
- `prefers-reduced-motion` já reduz scroll suave.

`lucide-react` existe, mas a home evita ícone genérico em excesso. A plataforma deve manter esse critério.
