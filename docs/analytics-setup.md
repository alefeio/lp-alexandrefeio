# Configuração de mensuração

A aplicação emite eventos padronizados no `dataLayer`. O Google Tag Manager encaminha esses eventos para GA4, Google Ads e Meta Pixel conforme o consentimento do visitante.

## 1. Variável de ambiente

```env
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
```

Sem essa variável, o site funciona normalmente e nenhum script do GTM é carregado.

## 2. Container no GTM

1. Crie um container Web em [Google Tag Manager](https://tagmanager.google.com/).
2. Copie o ID `GTM-XXXXXXX` para `NEXT_PUBLIC_GTM_ID`.
3. Publique somente depois de testar no Preview.

## 3. Consent Mode

Ordem de inicialização:

1. Consent Mode `default` = denied (uma vez, antes das tags)
2. GTM carrega (se `NEXT_PUBLIC_GTM_ID` existir)
3. Preferência em `localStorage` é lida no cliente
4. Se existir preferência, `gtag('consent', 'update', …)` e evento `consent_update` no `dataLayer`

Antes de tags de analytics/publicidade, o default é:

- `analytics_storage: denied`
- `ad_storage: denied`
- `ad_user_data: denied`
- `ad_personalization: denied`
- `wait_for_update: 500`

Quando o visitante escolhe no banner (ou uma preferência salva é restaurada), a aplicação chama `gtag('consent', 'update', …)` e em seguida envia ao `dataLayer`:

```text
event: consent_update
consent_analytics: boolean
consent_marketing: boolean
```

Sem PII. Esse evento não é conversão; serve para o GTM reagir à decisão.

| Escolha | analytics_storage | ad_storage | ad_user_data | ad_personalization |
| --- | --- | --- | --- | --- |
| Recusar não essenciais | denied | denied | denied | denied |
| Analytics apenas | granted | denied | denied | denied |
| Marketing apenas | denied | granted | granted | granted |
| Aceitar todos | granted | granted | granted | granted |

Os eventos de negócio (`generate_lead`, etc.) são empurrados no `dataLayer` quando a ação real acontece. Eles **não** dependem do consentimento de analytics.

No GTM:

- tags de GA4 devem exigir `analytics_storage = granted`;
- tags de Google Ads e Meta devem exigir `ad_storage` / marketing = granted.

Assim, com `analytics = denied` e `marketing = granted`, `generate_lead` existe no `dataLayer` e Ads/Meta podem consumi-lo; o GA4 não.

## 4. Eventos disponíveis no dataLayer

| Evento | Quando dispara |
| --- | --- |
| `consent_update` | Preferência salva ou restaurada no bootstrap (`consent_analytics`, `consent_marketing`) |
| `cta_click` | CTA relevante acionado |
| `whatsapp_click` | Link de WhatsApp acionado |
| `service_interest` | Interesse em uma oferta |
| `form_start` | Primeira interação no formulário, uma vez por sessão |
| `form_submit` | Tentativa válida de envio |
| `generate_lead` | E-mail administrativo aceito pelo Resend (evento de negócio; consumo por plataforma depende do Consent Mode) |

Parâmetros comuns:

- `cta_name`, `cta_location`, `destination_type`
- `service_name` (`site_essencial`, `site_trafego`, `gestao_trafego`)
- `lead_source`, `lead_medium`, `lead_campaign`

Nunca incluem nome, e-mail, WhatsApp ou outros dados pessoais.

## 5. GA4

1. Crie uma tag de configuração GA4 no GTM.
2. Crie triggers Custom Event para cada evento acima.
3. Marque `generate_lead` como conversão principal.
4. Não marque `form_submit` como conversão principal.

## 6. Google Ads

1. Crie ou importe a conversão no GTM com trigger Custom Event `generate_lead`.
2. A conversão nativa prevista é “Lead - Formulário do site”, com valor e moeda definidos no GTM (não no código).
3. Exija consentimento de marketing (`ad_storage`, `ad_user_data`, `ad_personalization`) na tag.
4. Não configure conversion ID ou label no código da aplicação.
5. Enhanced Conversions permanece desativada.

## 7. Meta Pixel

1. Configure o Pixel no GTM, não no código da aplicação.
2. Dispare o evento padrão `Lead` quando receber `generate_lead`.
3. Exija consentimento de marketing no GTM.

## 8. Testes

1. Abra o site com `NEXT_PUBLIC_GTM_ID` configurado.
2. Use o Preview do GTM.
3. Aceite cookies de analytics.
4. Interaja com CTA, WhatsApp, serviço e formulário.
5. Confirme que `generate_lead` só aparece após envio administrativo aceito.
6. Valide no DebugView do GA4.

## 9. Métricas do blog

`/admin/blog/metricas` lê visualizações e origem no GA4 Data API, só para administrador. Sem as variáveis abaixo, a página mostra configuração pendente e não inventa números.

```env
GA4_PROPERTY_ID=
GA4_CLIENT_EMAIL=
GA4_PRIVATE_KEY=
```

`GA4_PROPERTY_ID` é o número da propriedade, não o ID `G-`. A conta de serviço precisa do papel de leitor nessa propriedade. A chave fica só no ambiente. O painel pede caminhos `/blog`, normaliza query string e UTM, e relaciona o slug aos artigos publicados. Rascunhos não aparecem como conteúdo publicado.

O site não envia `page_view`. Quem mede a página é o GA4 via GTM, com Consent Mode. Navegação interna do App Router não dispara outro pageview neste código, para não duplicar o carregamento inicial.

O histórico efetivamente coletado é o que o GTM registrou com consentimento. A Data API devolve o relatório agregado disponível na hora da consulta. A retenção de eventos e usuários vale para Explorações e para dados no nível do usuário. Este painel não trata esse prazo como limite dos relatórios agregados.

`runReport` interpreta `startDate`, `endDate` e a dimensão `date` no fuso da propriedade. O painel lê `timeZone` nos metadados da propriedade quando a conta permite, pede o intervalo nesse fuso e não altera a configuração. Se o fuso não vier, a tela avisa e não assume Belém.

Visualizações, origem e evolução usam o mesmo conjunto visível. Usuários ativos do cartão só aparecem quando o total deduplicado da API cobre exatamente esse conjunto. Caminhos de rascunho saem da conta e, nesse caso, o total de usuários fica ausente em vez de somar páginas.

Cliques do artigo usam o evento existente `cta_click`, com `cta_location=blog_post`, `destination_type` e `blog_post_slug`. A listagem usa `cta_location=blog_index`. “Conhecer a gestão” continua em `service_from_course_click`. Esses parâmetros só viram relatório depois que o GTM os encaminhar e o GA4 registrar a dimensão. Até lá o painel não mostra contagem de clique. Não publique tag nova automaticamente.

A fundação first-party fica em `BlogReadingSession` e `BlogCommercialClick`. O endpoint `POST /api/analytics/blog-reading` responde 404 enquanto `BLOG_READING_INGEST_ENABLED` não for exatamente `true`. Sem essa variável, a rota não grava. O pseudônimo é `af_blog_reader_id_v1`, separado de `af_journey_id_v1`, e não se liga a conta nem a compra. Sessão engajada significa pelo menos 30 segundos ativos e 50% do conteúdo. Leitura profunda significa pelo menos 60 segundos ativos e 75% do conteúdo ou o final alcançado. São critérios operacionais, calculados na leitura, não uma coluna nem uma prova de leitura. A mesma sessão continua só com menos de 30 minutos desde a última atividade. Registros individuais expiram 12 meses após `startedAt`, no cron `/api/cron/blog-reading-retention`. O painel administrativo continua no GA4 até a etapa do dashboard.

## 10. O que fica fora do código

- Measurement ID do GA4
- Conversion ID/label do Google Ads
- Pixel ID da Meta

Esses valores permanecem no GTM.
