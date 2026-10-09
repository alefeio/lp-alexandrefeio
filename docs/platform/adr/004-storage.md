# ADR 004 — Storage público e privado

Status: PROPOSED para a separação. PENDING para o vendor dos arquivos privados.

## Contexto

Imagens de curso podem ser públicas. CSV, XLSX e PDF do aluno podem ter dados comerciais. A API Apimages autentica o upload e entrega o arquivo em URL pública.

## Decisão proposta

Imagens editoriais usam APIMG, com a chave só no servidor. O banco guarda `url` e `public_id`.

Arquivos do aluno não usam APIMG, mesmo que a API aceite o MIME. Ficam em storage privado com acesso pela sessão.

## Pendência

Qual serviço guarda o arquivo privado. Não escolher S3, Vercel Blob nem Spaces nesta sprint.

## Consequência

Não existe helper de upload ainda. `APIMG_API_KEY` e `APIMG_UPLOAD_URL` não estão no ambiente deste repositório.
