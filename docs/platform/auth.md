# Autenticação

Status: inexistente neste site. Proposta, não implementação.

## Estado atual

Não há usuário, sessão, cookie de login, middleware nem provedor. O único identificador de uma pessoa é o que ela digita no formulário de contato, e isso vai para o e-mail, não para uma conta.

## O que a V1 precisa

Conta do aluno, sessão, área `/app`, compras, progresso, projetos, arquivos privados e um admin. O mesmo `User` serve aluno e admin; o papel distingue.

## Opções

| Opção | Leitura |
| --- | --- |
| E-mail e senha | Já validada no evolUSG com Better Auth, verificação e reset. Este site já tem Resend |
| Magic link | Melhor para quem não quer senha. Não existe no evolUSG. Exige o mesmo cuidado de token e expiração |
| Google | Menos atrito. Não existe no evolUSG. Exige cliente OAuth e política de conta sem e-mail verificado pelo provedor |

## Recomendação

`PROPOSED`: Better Auth + Prisma, e-mail e senha, verificação de e-mail obrigatória e recuperação de senha. E-mail transacional pelo Resend, chave só no servidor.

Não copiar allowlist de piloto clínico do evolUSG. Cadastro de aluno é aberto; admin não se autocadastra.

`PENDING`: magic link e Google. Podem entrar depois sem trocar o `User`, se o provedor guardar a mesma conta por e-mail verificado.

## Limites

- Segredo de auth sem `NEXT_PUBLIC_`.
- Cookie de sessão httpOnly, definido pela biblioteca no servidor.
- `/app` e `/admin` só com sessão. Admin além do papel.
- Arquivo privado nunca depende só de uma URL adivinhável.
- Não colocar e-mail, nome ou resposta do aluno no `dataLayer`.
