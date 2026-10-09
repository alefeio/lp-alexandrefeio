# Sprint 0 — auditoria e arquitetura

Data da auditoria: 9 de outubro de 2026. Nenhuma feature de produto, schema, migration ou integração de pagamento foi criada.

## 1. Estado atual

O repositório é a landing pessoal de Alexandre Feio (`https://alexandrefeio.com.br`).

Páginas:

| Rota | Papel |
| --- | --- |
| `/` | Home |
| `/trafego-pago` | Landing comercial de gestão de tráfego pago |
| `/privacidade` | Política curta do formulário |
| `/obrigado` | Confirmação pós-lead, `noindex` |

O formulário usa Server Action e Resend. O `generate_lead` só dispara no cliente depois que o e-mail administrativo é aceito. Não existe área autenticada, curso, pedido ou arquivo de aluno.

`README.md` e `MVP_STATUS.md` descrevem o produto atual. Cases continuam mockados e fora da home enquanto `isMock` for verdadeiro.

## 2. Stack encontrada

| Peça | Encontrado no código |
| --- | --- |
| Framework | Next.js 16.3.8, App Router, TypeScript 5, React 19.2.8 |
| Estilo | Tailwind CSS 4, tokens em `src/app/globals.css`, fontes Geist |
| E-mail | `resend` 6.x, Server Action `src/app/actions/submit-lead.ts` |
| Ícones | `lucide-react` só no menu mobile |
| Banco | Não há dependência `prisma`, pasta `prisma/`, client nem migration |
| Auth | Não há |
| Middleware | Não há |
| Upload | Não há |
| Testes | Scripts `scripts/check-seo.ts`, `check-analytics.ts`, `check-lead.ts` |
| Deploy | Sem `vercel.json` no repo. Build padrão `next build` |

Não há route groups. O layout raiz envolve todas as rotas com JSON-LD, GTM, consentimento, header e footer.

## 3. Banco e Prisma

### Como está hoje

O código não lê banco. Não há `schema.prisma`, seed, `PrismaClient` nem script de migration.

O `.env.local` local, ignorado pelo Git, contém quatro variáveis de Postgres que a aplicação não usa:

| Variável | Uso no código deste repo | Host observado, sem credencial |
| --- | --- | --- |
| `DATABASE_URL` | Nenhum | `db.prisma.io` (direto) |
| `RUNTIME_DATABASE_URL` | Nenhum | `pooled.db.prisma.io` |
| `POSTGRES_URL` | Nenhum | `db.prisma.io` (direto) |
| `PRISMA_DATABASE_URL` | Nenhum | `db.prisma.io`, esquema `postgres://` |

`.env.example` não documenta essas variáveis. Não há `DATABASE_ENV`. Não foi executada conexão, `migrate` nem `db push`.

### Contradição com a premissa

A premissa de que PostgreSQL + Prisma já estão integrados neste projeto não se confirma no código. As URLs existem só no ambiente local e apontam para Prisma Postgres. Enquanto o código não as referencia, não dá para afirmar que esse banco é o da plataforma, que está vazio, ou que é seguro migrar nele.

### Riscos

- Tratar essas URLs como “o banco da V1” e aplicar migration sem rótulo de ambiente.
- Usar a URL pooled para migration, ou a URL direta como runtime serverless.
- Usar `PRISMA_DATABASE_URL` como se fosse Prisma Accelerate. Neste arquivo o esquema é `postgres://`, no mesmo host direto das outras URLs diretas.
- Quatro nomes para, na prática, duas conexões (direta e pooled), sem documentação de qual ambiente representam.

### Recomendação

Não remover variáveis nesta sprint. Quando a fundação for implementada, seguir o padrão já validado no evolUSG, descrito em [database.md](./database.md) e no [ADR 001](./adr/001-prisma-postgres.md). Status: `PROPOSED`, bloqueado até confirmar a posse e o ambiente desse Postgres.

## 4. Comparação com evolUSG

Repositório local inspecionado: `DraKarenVieira/Projetos/evolUSG`. Não foi copiado para este projeto.

| Ponto | O que foi verificado |
| --- | --- |
| Prisma | 7.10, client em `src/generated/prisma`, datasource sem URL no schema |
| Runtime | `src/lib/db/prisma.ts`: `PrismaPg` + singleton em `globalThis` fora de production |
| URL de runtime | `RUNTIME_DATABASE_URL` ou, se vazia, `DATABASE_URL` |
| Migrations | `prisma.config.ts`: `DIRECT_URL`, senão `POSTGRES_URL`, senão `DATABASE_URL`. `RUNTIME_DATABASE_URL` não entra |
| `PRISMA_DATABASE_URL` | Documentada como URL nativa/Accelerate se existir. O CLI do evolUSG não a usa para migrar nem para o client |
| Ambiente | `DATABASE_ENV` bloqueia `migrate deploy` fora de `development`, `preview` ou `test` |
| Auth | Better Auth, e-mail/senha, verificação de e-mail, reset de senha, adapter Prisma. Sem magic link e sem Google |
| APIMG | Não implementado. Documentos do evolUSG registram APIMG como fora de escopo |

Não foi possível verificar, nesta sessão, os valores reais das variáveis na Vercel do evolUSG nem da Vercel deste site. A documentação local do evolUSG afirma que, naquele projeto, as URLs de banco de preview e production apontam para o mesmo banco. Isso não deve ser assumido aqui.

## 5. APIMG

`APIMG_API_KEY` e `APIMG_UPLOAD_URL` não estão no `.env.local` nem no `.env.example` deste repositório. O site não faz upload.

O serviço foi inspecionado no repositório local `Apimages`, não por uma chamada autenticada:

- `POST /v1/upload`, multipart, campo `file`.
- Autenticação: `X-API-Key` ou `Authorization: Bearer`. A chave fica no servidor da API.
- Resposta: `url`, `public_id`, `width`, `height`, `format`, `bytes`.
- Leitura: `GET /i/{public_id}` sem autenticação.
- Limite padrão documentado: 10 MB. Imagens raster podem ser redimensionadas.
- A API também aceita PDF, CSV e XLSX, mas a URL resultante é pública.

Recomendação: imagens editoriais de curso passam por um helper só de servidor, no padrão desse contrato. A chave nunca usa prefixo `NEXT_PUBLIC_`. Arquivos de aluno não usam essa API. Detalhe em [storage.md](./storage.md). Status do helper: não implementado.

## 6. Autenticação

Não há sessão, usuário nem provedor neste site. Proposta em [auth.md](./auth.md): Better Auth com e-mail e senha, verificação e recuperação, reutilizando Resend. Magic link e Google ficam `PENDING`.

## 7. Arquitetura proposta

A landing permanece a casca pública. A plataforma entra depois, no mesmo domínio e com os mesmos tokens, em áreas separadas do layout de marketing. Ver [architecture.md](./architecture.md).

Um curso na V1 (`Tráfego Pago na Prática para Pequenos Negócios`), com `Course` genérico o bastante para outro curso depois, sem catálogo, marketplace ou multi-instrutor.

## 8. Modelo conceitual

Agregados e o que não misturar estão em [database.md](./database.md). Pedido não é direito de acesso. Diagnóstico não é análise de arquivo. Imagem pública não é upload do aluno.

## 9. Aulas textuais

Blocos com chave estável, progresso por bloco, sem pixel de scroll. Ver [content-model.md](./content-model.md).

## 10. Storage

Imagens públicas: APIMG, server-side. Relatórios CSV/XLSX/PDF: storage privado ainda não escolhido. Ver [storage.md](./storage.md).

## 11. Pagamentos

Mercado Pago não entra agora. O desenho separa `Order`, `OrderItem`, `Payment` e `Entitlement`, com preço gravado no item e crédito de upgrade fora do entitlement. Ver [payments.md](./payments.md).

## 12. Analytics e consentimento

Eventos atuais permanecem. Novos eventos de aula e compra ficam só como convenção, sem PII. Ver [analytics.md](./analytics.md) e `docs/analytics-setup.md`.

## 13. Segurança

Ver [security.md](./security.md). Nenhum secret foi copiado para estes documentos.

## 14. SEO

Páginas públicas de curso e módulo podem ser indexadas. Corpo de aula paga não entra no sitemap nem fica aberto ao crawler. `/app` e `/admin` ficam `noindex`. Canonical continua no apex. Ver [architecture.md](./architecture.md).

## 15. Pastas e rotas sugeridas

Não criar agora. Quando a implementação começar:

```text
src/app/(marketing)/     home, trafego-pago, privacidade, obrigado
src/app/(platform)/cursos
src/app/(platform)/aulas/[slug]
src/app/(app)/app        área do aluno, sem header de marketing
src/app/(app)/app/projetos/[id]
src/app/(app)/app/analisar
src/app/(admin)/admin
src/lib/db               client Prisma, quando existir
src/lib/auth             quando existir
src/lib/storage          upload server-side, quando existir
```

O layout raiz hoje impõe header e footer em toda rota. Antes de `/app`, as rotas atuais precisam ir para um route group de marketing. Isso é refactor estrutural, não desta sprint.

## 16. ADRs

| ADR | Status |
| --- | --- |
| [001 Prisma/Postgres](./adr/001-prisma-postgres.md) | PROPOSED |
| [002 Blocos de conteúdo](./adr/002-content-blocks.md) | PROPOSED |
| [003 Order e Entitlement](./adr/003-order-entitlement.md) | PROPOSED |
| [004 Storage público e privado](./adr/004-storage.md) | PROPOSED / PENDING no vendor privado |
| [005 Autenticação](./adr/005-auth.md) | PROPOSED / PENDING em magic link e Google |

## 17. Riscos e pendências

1. Confirmar se as URLs locais de Postgres pertencem a este produto e se são desenvolvimento, preview ou produção.
2. Confirmar na Vercel deste projeto se essas variáveis existem e se preview e production apontam para bancos diferentes.
3. `APIMG_API_KEY` e `APIMG_UPLOAD_URL` ainda não estão no ambiente deste site.
4. Escolher storage privado para CSV/XLSX/PDF. APIMG não serve: a leitura é pública.
5. Política de reembolso: revogar entitlement ou manter acesso. Não decidir agora.
6. Magic link e login Google não estão validados no evolUSG.
7. O layout global precisa de route groups antes da área logada.
8. Política de privacidade atual cobre o formulário de contato, não conta, pagamento nem arquivo do aluno.

## 18. Proposta da Sprint 1

Fundação, ainda sem curso, aula, pagamento ou área do aluno.

Só começa depois de rotular o banco (`DATABASE_ENV`) e confirmar que não é produção compartilhada.

Escopo sugerido, quando isso estiver claro:

1. Acrescentar Prisma 7 no padrão do evolUSG, sem tabelas de produto.
2. Documentar as variáveis no `.env.example`, sem valores.
3. Não rodar `migrate deploy` em produção nem `db push`.
4. Deixar autenticação para a sprint seguinte, ou na mesma sprint apenas se o banco já estiver confirmado como desenvolvimento.

Não copiar modelos clínicos do evolUSG.

## 19. Arquivos desta sprint

Documentação nova em `docs/platform/`, incluindo `adr/`. O `README.md` da raiz ganha apenas um ponteiro. Nenhum código de produto foi alterado.
