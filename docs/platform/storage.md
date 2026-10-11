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

Contrato confirmado no código atual do serviço Apimages (`app/main.py`, `app/auth.py`, `app/config.py`):

- `POST /v1/upload`, multipart, um único campo obrigatório: `file`. Não há outro campo obrigatório.
- `APIMG_UPLOAD_URL` é a URL completa desse endpoint. O site não acrescenta `/v1/upload`.
- Autenticação: o serviço aceita `X-API-Key` ou `Authorization: Bearer`. Este projeto envia só `X-API-Key`. Não há segunda tentativa.
- A chave autorizada é uma só: a variável `API_KEY` no `.env` do servidor Apimages, comparada por igualdade. Não há banco, allowlist nem cadastro por cliente. Chave ausente no servidor responde 503 (`API_KEY não configurada no servidor`). Chave diferente ou ausente na requisição responde 401 (`Chave de API inválida ou ausente`).
- Resposta de sucesso: `url`, `public_id`, `width`, `height`, `format`, `bytes`.
- Leitura: `GET /i/{public_id}` sem autenticação. Id inexistente responde 404.
- Limite padrão do serviço: 10 MB (`MAX_UPLOAD_BYTES`). Este site recusa arquivo acima de 5 MB antes de chamar o serviço.
- Formatos aceitos aqui: JPEG, PNG e WebP, conferidos pelos bytes. SVG não entra.

Um POST direto de development, com a URL e a chave deste ambiente, chegou ao serviço e recebeu 401 com a mensagem acima. A URL estava completa, em HTTPS, no host do serviço, sem caminho duplicado. A chave local existe, tem 64 caracteres, sem espaço nem prefixo `Bearer`, e não é a chave de exemplo do repositório Apimages. O bloqueio é a chave deste site ser diferente da `API_KEY` do servidor. Para o upload passar, `APIMG_API_KEY` precisa ser exatamente essa `API_KEY`. Não há outro registro a criar.

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
