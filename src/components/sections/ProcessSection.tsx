"use client";

import { useEffect, useRef, useState } from "react";
import { processIntro, processSteps } from "@/data/process";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ProcessSection() {
  const trackRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = trackRef.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setActive(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Section id="como-funciona" titleId="como-funciona-titulo">
      <Container>
        <SectionHeading
          eyebrow={processIntro.eyebrow}
          title={processIntro.title}
          titleId="como-funciona-titulo"
        />

        <ol ref={trackRef} className="process-track mt-12" data-active={active ? "true" : "false"}>
          {processSteps.map((step) => (
            <li key={step.number} className="relative pl-10 lg:pl-0 lg:pt-10">
              <span className="absolute top-0 left-0 z-10 grid size-6 place-items-center rounded-full border border-cta bg-background font-mono text-[10px] text-cta lg:left-0">
                {step.number}
              </span>
              <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
