export type SalesLesson = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number | null;
  accessType: "FREE" | "PAID";
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  priceCents: number | null;
  hasPublicPreview: boolean;
  hasBody: boolean;
  plannedResult?: string | null;
};

export type SalesModule = {
  id: string;
  title: string;
  description: string;
  bundlePriceCents: number | null;
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  lessons: SalesLesson[];
};

export type SalesCourse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  bundlePriceCents: number | null;
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  modules: SalesModule[];
};
