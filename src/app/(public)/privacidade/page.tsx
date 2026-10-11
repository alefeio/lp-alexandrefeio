import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/data/site-config";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como Alexandre Feio usa dados de contato, de conta e de estudo.",
  alternates: { canonical: "/privacidade" },
  openGraph: {
    url: "/privacidade",
    title: "Privacidade",
    description: "Como Alexandre Feio usa dados de contato, de conta e de estudo.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPage() {
  const host = new URL(siteConfig.url).host;

  return (
    <article className="py-16 sm:py-24">
      <Container>
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Privacidade</p>
          <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">Como os dados são usados</h1>
          <div className="mt-8 space-y-6 text-base leading-relaxed text-muted">
            <p>
              O formulário de {host} envia nome, empresa, WhatsApp, e-mail e o interesse escolhido. Esses dados servem
              para responder ao contato e para enviar a confirmação desta solicitação. Eles não são vendidos. O
              formulário não grava essa mensagem em banco de dados: ela passa por um provedor de e-mail e chega na
              caixa de {siteConfig.fullName}.
            </p>
            <p>
              Quem cria uma conta informa nome, e-mail e senha. A senha fica armazenada apenas como hash. O e-mail é
              usado para confirmar a conta e para enviar o link de recuperação de senha. A sessão fica em um cookie
              httpOnly, para manter o acesso à área autenticada. Esses dados de conta ficam no banco da plataforma e
              servem só para autenticação.
            </p>
            <p>
              Quem estuda uma aula pode ter o progresso, as respostas das atividades, as notas e os marcadores salvos
              na conta. O progresso serve para retomar a aula. As notas são privadas e não aparecem para outras
              pessoas. As respostas ficam guardadas para a própria aula, sem análise automática. No navegador, antes
              do login, o progresso da aula gratuita fica só neste aparelho e não inclui nome nem e-mail.
            </p>
            <p>
              Quem cria um projeto pode informar dados do negócio, como nome, segmento, oferta, objetivo, orçamento,
              site e área de atendimento. O diagnóstico de prontidão guarda as respostas, a nota, o gargalo principal e
              o histórico. Cada novo diagnóstico vira um registro novo; o anterior permanece. Esses dados servem para
              orientar o próximo passo dentro da conta. Eles não entram nas ferramentas de medição.
            </p>
            <p>
              O plano do projeto guarda tarefas, prazos e lembretes criados por quem usa a conta. O planejamento de
              recarga estima por quantos dias um saldo informado cobriria um valor diário também informado. Essa
              estimativa não vem do Google nem da Meta. Se o lembrete por e-mail estiver ligado, a mensagem leva o
              título do lembrete e o nome do projeto, com um link para o plano. Ela não leva respostas de diagnóstico,
              notas nem valores de orçamento.
            </p>
            <p>
              O site pode usar tecnologias de medição, analytics e publicidade conforme a escolha feita no banner de
              cookies. Essa escolha pode ser alterada depois em Preferências de cookies, no rodapé. Informações de
              campanha, como origem, mídia e parâmetros de anúncio presentes na URL, podem acompanhar a solicitação
              para identificar de onde o contato veio. Esses dados administrativos não entram nas ferramentas de
              analytics sem consentimento.
            </p>
            <p>
              Dúvidas sobre este uso podem ser enviadas para{" "}
              <a className="text-foreground underline underline-offset-4" href={`mailto:${siteConfig.contact.email}`}>
                {siteConfig.contact.email}
              </a>
              .
            </p>
          </div>
          <p className="mt-10">
            <Link href="/" className="text-sm text-foreground underline underline-offset-4">
              Voltar ao início
            </Link>
          </p>
        </div>
      </Container>
    </article>
  );
}
