import type { Metadata } from "next";
import { TrafegoPagoLanding } from "@/components/trafego-pago/TrafegoPagoLanding";
import { siteConfig } from "@/data/site-config";

const title = "Gestão de Tráfego Pago";
const description =
  "Gestão de tráfego pago, Google Ads e estrutura de conversão para empresas. Anúncios, páginas e mensuração trabalhando juntos.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/trafego-pago" },
  openGraph: {
    url: "/trafego-pago",
    title: `${title} | ${siteConfig.name}`,
    description,
  },
  twitter: {
    title: `${title} | ${siteConfig.name}`,
    description,
  },
  robots: { index: true, follow: true },
};

export default function TrafegoPagoPage() {
  const personId = `${siteConfig.url}/#person`;
  const service = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Gestão de Tráfego Pago",
    serviceType: "Gestão de tráfego pago",
    url: `${siteConfig.url}/trafego-pago`,
    description,
    provider: { "@id": personId },
    areaServed: [
      { "@type": "City", name: siteConfig.location.city },
      { "@type": "Country", name: "Brasil" },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(service) }} />
      <TrafegoPagoLanding />
    </>
  );
}
