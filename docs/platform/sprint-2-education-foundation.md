# Sprint 2 — fundação educacional

Continua no Postgres de desenvolvimento da Sprint 1. Não há banco de production. Não houve `db push`.

## Models

`Course`, `Module`, `Lesson`, `LessonBlock`, `LessonProgress`, `LessonBlockProgress`, `LessonResponse`, `LessonNote`, `LessonBookmark`, `LessonResult`.

`LessonBookmark` ficou separado do progresso: marcar um bloco não é concluí-lo. `LessonNote` é uma nota por usuário, aula e `blockKey`. `LessonResult` é um por usuário e aula.

Não há `QUESTION`. Pergunta fechada é `CHECKPOINT`. Não há pré-requisito entre aulas.

## Blocos

Tipos: `TEXT`, `HEADING`, `CALLOUT`, `EXAMPLE`, `CHECKPOINT`, `ACTIVITY`, `CHECKLIST`, `RESULT`, `CONCLUSION`, `IMAGE`.

O corpo é JSON validado com Zod, por tipo. Texto é texto puro. A página não usa HTML do banco. `IMAGE` aceita só `https` e `publicId` opcional, sem upload.

`lessonId + blockKey` é único. `blockKey` não segue posição. Bloco removido de aula publicada deve ganhar `retiredAt`, não reutilizar a chave.

## Progresso

Entram no percentual só blocos ativos com `countsForProgress`. Título de seção fica de fora.

- Texto, callout, exemplo, conclusão e imagem: concluídos quando o bloco entra na tela (`IntersectionObserver`, limiar 0.6), em lote a cada 1,5 s.
- Checkpoint: concluído com a opção correta, quando ela existe.
- Atividade: concluído ao salvar texto.
- Checklist: concluído quando todos os itens estão marcados.
- Resultado: concluído ao salvar o `LessonResult`.

`lastBlockKey` guarda a chave do último bloco alcançado. O botão “Continuar de onde você parou” rola até `id="b-{blockKey}"`.

## Anônimo e merge

Aula `FREE` publicada abre sem login. O progresso anônimo fica em `localStorage` (`af_lesson_progress_v1`), sem nome, e-mail ou id de usuário.

Depois do login, se não houver progresso no servidor, o estado local é importado. Se o servidor for mais recente, ele permanece. Se o local for mais recente, os blocos vistos se unem e a resposta já gravada no servidor prevalece.

## FREE e PAID

`FREE` publicada com blocos: corpo no leitor. `PAID`: só resumo e preview, com “Disponível em breve”. O corpo pago não é consultado. Rascunho responde 404. Não há checkout nem bypass de admin.

Aula gratuita sem blocos fica no curso, fora do sitemap, com aviso de texto em preparação.

## Seed

`npm run db:seed` só fora de production. Cria o curso, os módulos e as 12 aulas se ainda não existirem. Não atualiza texto já gravado. Os blocos da aula de demonstração só nascem se a aula ainda não tiver bloco.

## Analytics e SEO

`lesson_started`, `lesson_progress` (25, 50, 75) e `lesson_completed` (100) vão ao `dataLayer` só com consentimento de analytics. Campos: `lesson_slug`, `course_slug`, `access_type`, `progress_bucket`.

`/cursos` e curso publicado são indexáveis. Aula gratuita com corpo também. Preview pago pode entrar no sitemap. Rascunho não. `/app` e `/admin` continuam `noindex`.

## Limitações

Sem pagamento, entitlement, segundo curso, editor admin, upload, vídeo, diagnóstico ou projeto. Preço está no banco e ainda não se compra.
