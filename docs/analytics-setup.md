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

A aplicação envia sinais padrão negados antes do GTM carregar:

- `analytics_storage: denied`
- `ad_storage: denied`
- `ad_user_data: denied`
- `ad_personalization: denied`

Quando o visitante aceita cookies, a aplicação envia `consent_update` no `dataLayer` com os novos valores.

No GTM, configure tags de analytics e marketing para respeitar Consent Mode.

## 4. Eventos disponíveis no dataLayer

| Evento | Quando dispara |
| --- | --- |
| `cta_click` | CTA relevante acionado |
| `whatsapp_click` | Link de WhatsApp acionado |
| `service_interest` | Interesse em uma oferta |
| `form_start` | Primeira interação no formulário, uma vez por sessão |
| `form_submit` | Tentativa válida de envio |
| `generate_lead` | E-mail administrativo aceito pelo Resend |

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

1. Importe a conversão do GA4 ou crie uma tag de conversão baseada no evento `generate_lead`.
2. Não configure conversion ID ou label no código da aplicação.
3. Exija consentimento de marketing no GTM.

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

## 9. O que fica fora do código

- Measurement ID do GA4
- Conversion ID/label do Google Ads
- Pixel ID da Meta

Esses valores permanecem no GTM.
