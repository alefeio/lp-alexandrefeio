# Plataforma — planejamento

Esta pasta descreve a auditoria e a arquitetura da V1. Não implementa cursos, pagamentos, área do aluno nem alterações de banco.

O site publicado continua sendo a landing de Alexandre Feio: formulário via Resend, mensuração via GTM e páginas públicas. Não há Prisma, autenticação nem upload no código desta aplicação.

## Leitura

| Documento | Conteúdo |
| --- | --- |
| [sprint-0-audit.md](./sprint-0-audit.md) | Relatório da Sprint 0 |
| [architecture.md](./architecture.md) | Arquitetura proposta e rotas futuras |
| [database.md](./database.md) | Banco, variáveis e modelo conceitual |
| [auth.md](./auth.md) | Autenticação |
| [content-model.md](./content-model.md) | Aulas textuais, blocos e progresso |
| [storage.md](./storage.md) | Imagens públicas e arquivos privados |
| [payments.md](./payments.md) | Pedido, pagamento e direito de acesso |
| [analytics.md](./analytics.md) | Eventos atuais e convenção futura |
| [security.md](./security.md) | Revisão inicial de segurança |

ADRs ficam em [adr/](./adr/). Status `PROPOSED` ou `PENDING` não é decisão implementada.

Mensuração e SEO já publicados continuam em `docs/analytics-setup.md` e `docs/seo.md`.
