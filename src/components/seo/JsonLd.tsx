import { siteConfig } from "@/data/site-config";

/** Structured data mínimo e verificável. Sem reviews, rating, endereço ou preços inventados. */
export function JsonLd() {
  const personId = `${siteConfig.url}/#person`;
  const websiteId = `${siteConfig.url}/#website`;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: siteConfig.url,
        name: siteConfig.name,
        description: siteConfig.seo.description,
        inLanguage: "pt-BR",
        publisher: { "@id": personId },
      },
      {
        "@type": "Person",
        "@id": personId,
        name: siteConfig.name,
        alternateName: siteConfig.fullName,
        url: siteConfig.url,
        image: `${siteConfig.url}/alexandre.jpg`,
        jobTitle: "Criação de sites e tráfego pago",
        description: siteConfig.seo.description,
        email: siteConfig.contact.email,
        sameAs: [siteConfig.contact.instagramUrl],
        knowsAbout: ["Criação de sites", "Landing pages", "Tráfego pago"],
        areaServed: [
          {
            "@type": "City",
            name: siteConfig.location.city,
            containedInPlace: {
              "@type": "State",
              name: siteConfig.location.state,
            },
          },
          {
            "@type": "Country",
            name: "Brasil",
          },
        ],
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
  );
}
