# Sprint 2.1 — UX e robustez do aprendizado

Sprint curta em cima do commit `e034025`. Não houve migration. Não entrou Project, diagnóstico, IA, pagamento, upload nem aula nova.

## Problemas encontrados

- O botão de retomada rolava de novo sempre que `lastBlockKey` mudava, inclusive durante a leitura.
- No cliente anônimo, um checkpoint já certo continuava contando depois de uma resposta errada.
- Recarregar a aula anônima restaurava o texto da atividade e o checklist, mas o percentual ignorava os dois até uma nova gravação.
- Se o progresso local fosse mais novo e apontasse para um bloco anterior, o merge trocava a retomada para trás.
- A nota ficava com a caixa aberta em todo bloco.
- O índice tratava seção como tarefa concluída ou pendente.
- A página paga repetia a frase do preview que falava em checkout.
- `/app/aprendizado` não colocava a retomada na frente.

## Ajustes

- Retomada só rola no clique, ou uma vez quando a URL vem de `?continuar=1`. O nome da seção aparece junto do botão. O bloco recebe `scroll-mt-28` e foco. Com `prefers-reduced-motion`, o scroll é instantâneo.
- Abrir a aula pelo catálogo não rola sozinho.
- O índice usa “Você está aqui”, “Já passou” e “Adiante”. No mobile, o índice fecha depois do salto.
- Notas começam em “Adicionar nota”. Com texto, viram “Minha nota”, com editar e excluir.
- Marcador diz “Marcar para revisar” / “Marcado para revisar”.
- Atividade, checklist e resultado mostram “salvo” e mantêm o texto depois do reload.
- Checkpoint explica a resposta, permite outra tentativa e não é prova. Resposta errada deixa de contar.
- Aula paga mostra o problema, o resultado esperado, o tempo, o preço e “Disponível em breve”. Sem compra e sem corpo.
- `/app` e `/app/aprendizado` abrem por “Continuar de onde você parou”.
- Tempo restante é `minutos estimados × (100 − percentual) / 100`, só com aula em andamento e percentual entre 1 e 99. Some quando a aula conclui.

A aula de demonstração foi relida. O texto já ensina um critério real e usa os tipos de bloco. Não foi reescrita: o seed não sobrescreve conteúdo já gravado, e esta sprint não é a produção editorial do curso.

## Progresso e conclusão

Três coisas distintas:

1. Conteúdo percorrido: percentual dos blocos ativos com `countsForProgress`. Texto, callout, exemplo, conclusão e imagem entram quando o bloco fica visível. Título de seção não entra.
2. Atividade para concluir: bloco `required` só conta quando a resposta vale. Checkpoint com opção correta, atividade com texto, checklist completo, resultado gravado.
3. Aula concluída: todo bloco que conta está feito e todo bloco obrigatório está feito. Ver o texto não conclui a aula se ainda falta checkpoint, atividade ou checklist obrigatório.

No leitor, o estado anônimo segue a mesma regra. Uma nova tentativa errada tira o checkpoint do percentual.

## Merge

- Sem local: fica o servidor.
- Sem servidor: importa o local.
- Servidor mais recente: o servidor permanece inteiro. O login não adota o ponto antigo.
- Local mais recente: une os blocos vistos. A retomada fica no bloco mais adiante da ordem da aula, não no mais recente se ele for anterior. Resposta e resultado já gravados no servidor prevalecem.

## Fluxo testado

Conta de desenvolvimento criada no navegador, com e-mail de confirmação real. A conta e os registros dela foram apagados depois. O alias não fica documentado aqui.

- Anônimo: leitura parcial, checkpoint certo e errado, atividade, checklist, retomada com o nome da seção, reload com texto e respostas.
- Login: o progresso anônimo entrou em 75%, no bloco adiante, com a resposta do servidor preservada quando o local mais novo trazia outra frase e um bloco anterior.
- Autenticado: nota criada e editada, marcador, reload, conclusão da aula, `/app/aprendizado` com nota e marcador na seção, sair e entrar de novo com nota, marcador, resposta e aula concluída.
- Mobile 320px: sem overflow horizontal. O índice fecha ao navegar e o foco vai para a seção.
- Desktop: o título do bloco retomado ficou abaixo do topo, com folga de 112px.

## Analytics

`lesson_started`, `lesson_progress` em 25, 50 e 75, e `lesson_completed` em 100. O mesmo marco não dispara de novo no navegador: a chave fica na sessão e no armazenamento local, sem usuário nem e-mail. Nota, resposta e conteúdo não entram no `dataLayer`. GTM e Consent Mode permanecem. No teste, os marcos 25, 50, 75 e a conclusão apareceram uma vez na sessão; o `dataLayer` dessa carga não tinha e-mail nem o texto da nota.

## Performance

Continua um `IntersectionObserver` por montagem do leitor e um envio em lote a cada 1,5 s. Não há request por bloco. Não medi Core Web Vitals em laboratório. O ajuste foi tirar o scroll repetido, que reexecutava trabalho sem o aluno pedir.

## Pendências

- O texto definitivo das outras aulas continua fora desta sprint.
- Compra, entitlement e corpo pago continuam de propósito indisponíveis.
- Não há autosave. O botão Salvar permanece.
- O tempo restante é estimativa da metadata, não tempo medido de leitura.
- Não houve auditoria formal de leitor de tela nem medição de Lighthouse.

## Sprint 3

O leitor textual está consistente para seguir. A Sprint 3 não começa neste commit.
