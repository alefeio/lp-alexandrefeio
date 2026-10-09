# Autenticação

Status: e-mail e senha implementados. Magic link e Google continuam pendentes.

## Implementado

Better Auth com Prisma. Cadastro, verificação de e-mail, login, logout e recuperação de senha. A senha não trafega de volta para o client. O papel padrão é `USER`. `ADMIN` só entra pelo script local `scripts/set-admin.ts`.

Rotas: `/cadastro`, `/verificar-email`, `/entrar`, `/esqueci-senha`, `/redefinir-senha`, `/app`, `/admin`.

O proxy exige cookie de sessão em `/app` e `/admin`. O layout confirma a sessão no servidor. `/admin` ainda exige `role = ADMIN`.

Os e-mails usam Resend e os mesmos remetentes do formulário, em `src/lib/email/auth-mail.ts`. O envio do lead comercial continua em `src/app/actions/submit-lead.ts`.

Links de e-mail usam `BETTER_AUTH_URL`. Se ela não existir, preview usa `VERCEL_URL` e production usa `https://alexandrefeio.com.br`. Desenvolvimento local usa `http://localhost:3000` só quando `BETTER_AUTH_URL` aponta para lá, ou como último fallback fora da Vercel.

Não há e-mail, nome, id de usuário nem token no `dataLayer`.
