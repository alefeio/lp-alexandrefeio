# Storage

Status: proposta. Nenhum upload foi ligado ao site.

## Duas classes de arquivo

| Classe | Exemplos | Quem lê | Ferramenta |
| --- | --- | --- | --- |
| Imagem editorial | Capa de curso, módulo, aula, figura da aula | Público, pode ir para HTML indexável | APIMG |
| Arquivo do aluno | CSV, XLSX, PDF de campanha ou relatório | Só o dono e o admin autorizado | Não é APIMG |

APIMG devolve URL pública e serve `GET /i/{public_id}` sem autenticação. O repositório `Apimages` também aceita PDF, CSV e planilha, mas isso não torna o arquivo privado. Relatório comercial do aluno não deve ir para lá.

## Imagens públicas

`APIMG_API_KEY` e `APIMG_UPLOAD_URL` ainda não estão no ambiente deste projeto. A Sprint 1 não implementou upload. Quando a imagem editorial entrar, as duas variáveis serão lidas só no servidor.

Contrato observado no serviço Apimages, não exercitado com chave neste projeto:

- `POST` na URL de upload, multipart, campo `file`.
- Header `X-API-Key` ou `Authorization: Bearer`.
- Resposta JSON: `url`, `public_id`, `width`, `height`, `format`, `bytes`.
- Erros observados no código da API: 401 chave ausente ou inválida, 503 se o servidor da API não tem chave, 404 na leitura de id inexistente.
- Limite padrão documentado: 10 MB. Imagem grande pode ser reduzida no servidor (lado máximo 2560 px, salvo configuração contrária).

Neste site as variáveis `APIMG_API_KEY` e `APIMG_UPLOAD_URL` ainda não existem. Quando existirem:

- só em código de servidor;
- nunca `NEXT_PUBLIC_`;
- o browser pede uma Server Action; a Action chama a API;
- o banco guarda `url` e `public_id`, não a chave.

O evolUSG não tem helper de APIMG. Não há implementação pronta para copiar. O padrão a seguir é o contrato acima, num módulo `src/lib/storage` futuro.

Imagens atuais do marketing são arquivos em `public/` (`alexandre.jpg`, logo, favicon), via `next/image`. Continuam assim.

## Arquivos privados

Requisito: CSV, XLSX e PDF podem ter dados comerciais. Acesso autenticado, sem URL permanente pública, sem conteúdo em log, analytics ou e-mail.

Opções, nenhuma escolhida:

| Opção | Nota |
| --- | --- |
| Object storage com URL assinada e tempo curto | Encaixa em arquivo grande. Vendor ainda não escolhido. Não adicionar S3, Blob ou Spaces nesta sprint |
| Arquivo cifrado no banco | Simples para arquivo pequeno. Ruim para planilha grande e para backup |
| Disco da aplicação na Vercel | Filesystem efêmero. Não serve |

Status do vendor: `PENDING`.

Até a escolha, a análise de relatório não tem onde gravar arquivo. Não usar APIMG como atalho.
