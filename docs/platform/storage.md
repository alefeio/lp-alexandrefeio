# Storage

Status: imagem editorial ligada na Sprint 6. Arquivo privado continua pendente.

## Duas classes de arquivo

| Classe | Exemplos | Quem lê | Ferramenta |
| --- | --- | --- | --- |
| Imagem editorial | Capa de curso, módulo, aula, figura da aula | Público, pode ir para HTML indexável | APIMG |
| Arquivo do aluno | CSV, XLSX, PDF de campanha ou relatório | Só o dono e o admin autorizado | Não é APIMG |

APIMG devolve URL pública e serve `GET /i/{public_id}` sem autenticação. O repositório `Apimages` também aceita PDF, CSV e planilha, mas isso não torna o arquivo privado. Relatório comercial do aluno não deve ir para lá.

## Imagens públicas

`APIMG_API_KEY` e `APIMG_UPLOAD_URL` são lidas só no servidor, em `src/lib/storage/apimg.ts`. O browser envia o arquivo para uma Server Action de ADMIN.

Contrato observado no serviço Apimages, não exercitado com chave neste projeto:

- `POST` na URL de upload, multipart, campo `file`.
- Header `X-API-Key` ou `Authorization: Bearer`.
- Resposta JSON: `url`, `public_id`, `width`, `height`, `format`, `bytes`.
- Erros observados no código da API: 401 chave ausente ou inválida, 503 se o servidor da API não tem chave, 404 na leitura de id inexistente.
- Limite padrão documentado no serviço: 10 MB. Este site recusa arquivo acima de 5 MB antes de chamar o serviço, para ficar dentro desse teto.
- Formatos aceitos aqui: JPEG, PNG e WebP, conferidos pelos bytes. SVG não entra.

O banco guarda `MediaAsset` com `url`, `publicId`, largura, altura, formato, tamanho, alt e se a imagem é decorativa. A chave da API não é gravada.

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
