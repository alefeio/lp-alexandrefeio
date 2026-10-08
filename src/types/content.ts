export interface NavItem {
  href: string;
  label: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  items: readonly string[];
  cta: string;
  objectiveId?: string;
  featured?: boolean;
  tag?: string;
  /** Quando definido, o CTA da oferta abre esta rota em vez do formulário. */
  href?: string;
}

export interface CaseStudy {
  id: string;
  company: string;
  segment: string;
  challenge: string;
  solution: string;
  result: string;
  isMock: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface ProcessStep {
  number: string;
  title: string;
  description: string;
}

export interface ValuePillar {
  number: string;
  title: string;
  description: string;
}

export interface Differential {
  beforeLabel: string;
  before: string;
  afterLabel: string;
  after: string;
}

export interface FlowStep {
  number: string;
  role: string;
  title: string;
  description: string;
}

export interface LeadObjective {
  value: string;
  label: string;
}
