import { services, servicesIntro } from "@/data/services";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ServiceCard } from "@/components/sections/ServiceCard";

export function ServicesSection({ selectedServiceId }: { selectedServiceId?: string }) {
  return (
    <Section id="servicos" titleId="servicos-titulo">
      <Container>
        <SectionHeading
          eyebrow={servicesIntro.eyebrow}
          title={servicesIntro.title}
          description={servicesIntro.description}
          titleId="servicos-titulo"
        />

        <ul className="mt-10 grid gap-4 lg:grid-cols-3 lg:gap-5">
          {services.map((service) => (
            <li key={service.id}>
              <ServiceCard service={service} selected={service.id === selectedServiceId} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
