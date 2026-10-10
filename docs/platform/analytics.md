# Analytics e consentimento

A implementação atual está em `docs/analytics-setup.md`. Esta nota não muda código nem o container GTM.

## O que o site faz hoje

- `NEXT_PUBLIC_GTM_ID` opcional. Sem ela, nenhum script de tag é carregado.
- Consent Mode v2: default negado, uma vez, depois o GTM, depois a preferência salva.
- Preferência em `localStorage` (`af_consent_v1`).
- Evento `consent_update` com `consent_analytics` e `consent_marketing`, sem PII.
- Eventos de negócio, independentes do consentimento de analytics: `cta_click`, `whatsapp_click`, `service_interest`, `form_start`, `form_submit`, `generate_lead`.
- `generate_lead` só depois da confirmação do envio administrativo, uma vez por submissão, no cliente. A visita a `/obrigado` não é conversão.
- GA4, Google Ads e Meta não são instalados em componentes. O GTM decide o que disparar conforme o consentimento.

`service_interest` da oferta de tráfego usa `service_name: trafego_pago`.

## Convenção futura

`lesson_started`, `lesson_progress` e `lesson_completed` já entram no `dataLayer`, só depois do consentimento de analytics. O mesmo `trackEvent` e o mesmo GTM valem para o restante:

| Evento | Parâmetros permitidos |
| --- | --- |
| `lesson_started` | id público da aula, id do curso |
| `lesson_progress` | id da aula, fração ou número de blocos, sem texto |
| `lesson_completed` | id da aula |
| `diagnostic_started` | id do diagnóstico |
| `diagnostic_completed` | id do diagnóstico, código de resultado se for categoria estável, sem respostas |
| `checkout_started` | tipo do produto (`lesson`, `module`, `course`) e id público |
| `purchase_completed` | id do pedido interno, valor e moeda, sem e-mail |
| `analysis_started` | id da análise |
| `analysis_completed` | id da análise, status |

Proibido no `dataLayer`: nome, e-mail, telefone, notas, respostas, conteúdo de bloco, conteúdo de upload, URL de arquivo, identificador de pagamento externo com dados pessoais.

`purchase_completed` não dispara na página de obrigado do marketing nem só porque a rota de retorno abriu. Dispara depois que o servidor confirma o pagamento aprovado.
