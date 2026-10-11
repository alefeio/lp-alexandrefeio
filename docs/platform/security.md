# Segurança — revisão inicial

Atualização da Sprint 4: tarefa, lembrete e planejamento de saldo só existem depois de conferir `Project.userId` com a sessão. Projeto arquivado não recebe ação nova. O endpoint de lembrete exige `CRON_SECRET` e não está agendado. O e-mail do lembrete não leva resposta de diagnóstico nem valor de orçamento.

Atualização da Sprint 3: projeto, diagnóstico e recomendação saem da sessão. A action não aceita `userId` do cliente. Projeto ou diagnóstico de outra conta responde 404. Dinheiro fica em centavos inteiros. URL do site só passa se for `http` ou `https`. Resposta de diagnóstico, nome do negócio, orçamento e nota por dimensão não vão ao `dataLayer`.

Atualização da Sprint 2: progresso, resposta, nota, marcador e resultado saem da sessão. A action não aceita `userId` do cliente. Aula paga não carrega blocos. Nota e resposta não vão ao `dataLayer`.

Atualização da Sprint 1: conta usa Better Auth. Segredo e banco ficam no servidor. Sessão em cookie httpOnly. `/app` e `/admin` não confiam só no proxy: o layout relê a sessão. `/admin` exige `role = ADMIN`. Login, cadastro e recuperação passam pelo rate limit do Better Auth (10 por minuto, por instância). Não foi contratado serviço externo.

Headers nas respostas: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`. CSP completa não foi aplicada, para não interferir no GTM.

O formulário comercial continua com honeypot e tempo mínimo. Os logs de e-mail de auth registram nome e status do erro, não senha, token nem corpo.

Nenhum valor de ambiente foi copiado para a documentação.

## O que já está bem

- `.env*` está no `.gitignore`, com exceção de `.env.example`.
- `RESEND_API_KEY` e os endereços de envio são lidos só na Server Action.
- O client não recebe a chave. Se a configuração falta, a Action devolve recusa genérica e o log lista o nome da variável ausente, não o valor.
- GTM, Ads e Meta não estão hardcoded. O id do GTM é público de propósito (`NEXT_PUBLIC_`).
- O `dataLayer` sanitiza tipos e os eventos atuais não levam campos de contato.
- `generate_lead` não nasce da visualização de `/obrigado`.
- JSON-LD não inventa review, preço ou endereço.

## Achados

| Achado | Efeito |
| --- | --- |
| Quatro URLs de Postgres no `.env.local` sem uso no código | Risco operacional se alguém migrar esse banco achando que a app já o usa. Não são lidas pelo site |
| `APIMG_*` ausentes neste repo | Não há vazamento porque não há integração. A chave futura não pode ir ao client |
| `next.config.ts` sem headers de segurança | Sem `Content-Security-Policy`, `Referrer-Policy` ou `X-Frame-Options` no app. O GTM complica uma CSP rígida; tratar quando a plataforma existir, sem quebrar o container atual |
| Formulário público sem limite de taxa além do tempo mínimo e do honeypot | Spam ainda depende do Resend e da validação. Não é falha de sessão, porque não há sessão |
| Layout único | Uma rota nova autenticada herdaria header público se for criada sem route group |
| APIMG, no serviço separado | Leitura pública por id. Inadequado para arquivo de aluno |
| Política de privacidade | Cobre o contato atual. Conta, pagamento e arquivo exigem texto novo antes desses fluxos |

## Quando a plataforma existir

- Segredos de banco, auth, Mercado Pago e APIMG só no servidor.
- Webhook com conferência de assinatura e idempotência.
- Download de relatório só com sessão do dono.
- Log de erro sem corpo de arquivo, sem resposta de diagnóstico e sem connection string.
- Admin separado por papel, não por URL escondida.
