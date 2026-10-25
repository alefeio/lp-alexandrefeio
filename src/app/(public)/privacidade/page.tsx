import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/data/site-config";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como Alexandre Feio usa dados de contato, de conta, de estudo, de landing pages, de leads e de métricas.",
  alternates: { canonical: "/privacidade" },
  openGraph: {
    url: "/privacidade",
    title: "Privacidade",
    description: "Como Alexandre Feio usa dados de contato, de conta, de estudo, de landing pages, de leads e de métricas.",
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
              Uma compra registra o pedido, os itens, o valor e o status do pagamento. O pagamento é processado pelo
              Mercado Pago, por Pix ou cartão de crédito. Os dados do cartão são tratados pelo Mercado Pago e não ficam
              guardados neste site. O acesso a uma aula paga só abre depois da confirmação do pagamento. O e-mail de
              confirmação leva os itens, o total e um link para continuar estudando.
            </p>
            <p>
              O site pode usar tecnologias de medição, analytics e publicidade conforme a escolha feita no banner de
              cookies. Essa escolha pode ser alterada depois em Preferências de cookies, no rodapé. Informações de
              campanha, como origem, mídia e parâmetros de anúncio presentes na URL, podem acompanhar a solicitação
              para identificar de onde o contato veio. Esses dados administrativos não entram nas ferramentas de
              analytics sem consentimento. Esse banner vale para {host}. Landing pages publicadas por usuários da
              plataforma não carregam automaticamente o GTM, o Google Analytics nem o Meta Pixel da plataforma. O dono
              da página também não recebe essas ferramentas só por publicá-la. Uma integração própria, se existir no
              futuro, pede revisão desta página.
            </p>
            <h2 className="pt-4 text-lg font-semibold text-foreground">Landing pages criadas na plataforma</h2>
            <p>
              Usuários autenticados podem criar e publicar landing pages. Essas páginas podem ter botões, links
              externos, WhatsApp e formulários de contato. Os dados solicitados podem variar conforme o formulário
              configurado na página. O lead enviado pela landing page fica disponível somente para o usuário autenticado
              responsável pelo respectivo projeto. Ele não fica público e não fica visível para outro usuário da
              plataforma.
            </p>
            <p>
              Os dados enviados por esses formulários ficam na plataforma por até 12 meses a partir do envio. Depois
              desse prazo, são excluídos. Arquivar um lead organiza a lista do responsável e não amplia esse prazo.
              Esta página não promete que cópias de infraestrutura desapareçam no mesmo instante.
            </p>
            <p>
              A landing page pode registrar contagens agregadas de visualização da página, clique em CTA, clique para
              WhatsApp, início de formulário e envio concluído. Essas informações ficam como contagens agregadas por
              dia e por publicação. Não há histórico analítico individual do visitante para esses eventos. As contagens
              antigas são removidas depois de 24 meses.
            </p>
            <p>
              O aplicativo não armazena o endereço IP bruto nos registros de leads nem nas métricas agregadas do
              Landing Page Builder para fins analíticos. Para proteção contra abuso, a aplicação pode derivar
              identificadores técnicos temporários e pseudonimizados, usados em janelas de limitação de requisições.
            </p>
            <p>
              Imagens enviadas por quem cria a landing page podem ficar publicamente acessíveis para a página ser
              exibida. Esse arquivo fica no serviço de armazenamento de mídia utilizado pela plataforma, hoje a APIMG.
              Mídia usada pelo projeto ou por uma versão publicada pode permanecer enquanto for necessária para a página
              atual, para o histórico de publicações e para a restauração de versões. Uploads não utilizados podem ser
              removidos depois de uma janela técnica de limpeza.
            </p>
            <p>
              A ferramenta de IA pode ajudar o usuário autenticado a escrever o conteúdo da própria landing page. Dados
              enviados por visitantes nos formulários públicos não são encaminhados à OpenAI para gerar esse texto.
              Métricas dos visitantes também não são enviadas à OpenAI para esse fim.
            </p>
            <p>
              WhatsApp, links externos e outros provedores podem levar o visitante para serviços de terceiros. Depois
              que a pessoa segue esses links, o tratamento também passa a seguir as políticas desses serviços.
            </p>
            <p>
              Dúvidas sobre este uso, e solicitações relacionadas a dados, podem ser enviadas para{" "}
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
