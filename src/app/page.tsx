import type { Metadata } from "next";
import { AboutSection } from "@/components/sections/AboutSection";
import { CasesSection } from "@/components/sections/CasesSection";
import { DifferentialsSection } from "@/components/sections/DifferentialsSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Hero } from "@/components/sections/Hero";
import { MidCTA } from "@/components/sections/MidCTA";
import { ProblemSection } from "@/components/sections/ProblemSection";
import { ProcessSection } from "@/components/sections/ProcessSection";
import { ServicesSection } from "@/components/sections/ServicesSection";
import { ValueProposition } from "@/components/sections/ValueProposition";
import { findService } from "@/data/services";

/** Canonical da home sem query strings (UTM/GCLID/FBCLID/servico). */
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
  },
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const rawService = params.servico;
  const serviceId = Array.isArray(rawService) ? rawService[0] : rawService;
  const selectedService = findService(serviceId);

  return (
    <>
      <Hero />
      <ProblemSection />
      <ValueProposition />
      <ServicesSection selectedServiceId={selectedService?.id} />
      <DifferentialsSection />
      <MidCTA />
      <ProcessSection />
      <CasesSection />
      <AboutSection />
      <FAQSection />
      <FinalCTA selectedService={selectedService} />
    </>
  );
}
