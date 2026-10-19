# Dados privados de campanha

Infraestrutura para o aluno enviar um CSV ou XLSX do próprio projeto. A Aula 11 e a Aula 12 ainda não consomem esse dataset.

## Storage

O arquivo bruto e o dataset normalizado ficam no Vercel Blob com acesso `private`. O Postgres guarda só metadados, mapeamento, dimensões e métricas disponíveis.

Store dedicado: `alexandre-feio-private-data`, access private. Ele não recebe imagens públicas do site.

No runtime da Vercel, o SDK autentica com OIDC (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID`). O upload do browser usa `handleUploadPresigned`: o servidor emite uma autorização de `PUT` para um único pathname, válida por 5 minutos, com teto de tamanho. Não há URL pública permanente. A V1 não oferece download; a leitura passa pelo servidor com `get(pathname, { access: "private" })`.

## Ambiente

Preview (`VERCEL_ENV=preview`) recusa upload, mesmo que o store esteja conectado ao ambiente. Production e development podem gravar. O store de production não deve ser conectado a Preview. Development, quando precisar gravar de verdade, usa um store privado separado.

## Ownership

Cada import pertence ao usuário da sessão e a um Project desse usuário (`ownedProject`). O browser não envia `userId`. Outro usuário recebe o mesmo resultado de “não encontrado”, sem metadados do arquivo.

Arquivar o projeto não apaga os arquivos. Não existe exclusão física de Project. Uma exclusão futura precisa apagar os blobs antes de remover as linhas; o cascade do banco sozinho não apaga o Blob.

O admin operacional não lê o conteúdo.

## Formatos e limites

Aceitos: `.csv` e `.xlsx`. Rejeitados: `.xls`, `.xlsm`, `.xlsb`, `.ods` e qualquer outro. A extensão e o MIME do browser não decidem o formato; os bytes são lidos de novo no servidor.

Limites centralizados em `src/lib/campaign-data/limits.ts`: 10 MB, 50.000 linhas, 100 colunas, 10 planilhas, cabeçalho de 200 caracteres, célula de 10.000 caracteres. O ZIP do XLSX também limita entradas e o tamanho descompactado declarado. Acima disso, a mensagem é para exportar um período menor. Não há stack trace.

XLSX precisa ser OOXML real (`[Content_Types].xml` de planilha e `xl/workbook.xml`). Macro, senha e pacote inválido são recusados. O magic `PK` sozinho não basta.

Fórmulas não são executadas. Só entra o valor em cache quando a biblioteca o expõe como número, texto, booleano ou data. Sem cache, o valor fica de fora. Links externos e hiperlinks não são buscados.

CSV aceita UTF-8, com ou sem BOM. Se o UTF-8 falhar, a leitura tenta Windows-1252 e registra um aviso. O separador é vírgula, ponto e vírgula ou tab, pelo que produz colunas estáveis.

## Mapeamento e números

Aliases de Google Ads e Meta Ads, em português e inglês, são sugestões. O aluno confirma. `Results` / `Resultados` não viram conversão sozinhos. CTR, CPC, CPA, ROAS e taxa de conversão não entram como base.

`numberLocale` é `PT_BR` ou `EN_US`. Valor ambíguo não é adivinhado. Moeda: `BRL`, `USD` ou `OTHER`, sem conversão.

O dataset normalizado é NDJSON gzip no Blob privado (`normalized.json.gz`). Dinheiro fica em centavos inteiros. O arquivo original não é alterado e permanece até a exclusão.

## Métricas

`src/lib/campaign-data/metrics.ts` soma as bases e só então calcula CTR, CPC, taxa de conversão, CPA, ROAS, CPL, taxa de qualificação e custo por lead qualificado. Denominador ausente ou zero devolve `available: false` e `missingFields`. Não devolve 0 no lugar de “não sabemos”. Não faz média de razões.

A lista `availableMetrics` do import contém só o que as colunas mapeadas permitem. Coluna ausente não é inventada.

## Exclusão e logs

A exclusão valida o dono, apaga o bruto e o normalizado e marca `DELETED`. Nome, mapeamento, planilhas e avisos saem do registro. SHA-256, tamanho e status permanecem para auditoria. Não há prazo de 30 ou 90 dias.

Log permitido: `importId`, `projectId`, status, tamanho, quantidade de linhas e código de erro. Sem e-mail, linhas, termos, nomes de campanha, mapeamento ou URL assinada.

Não há evento de analytics para esse fluxo.

A rota `/app/projetos/[id]/dados` fica atrás da sessão, com `noindex`, e não entra no sitemap.
