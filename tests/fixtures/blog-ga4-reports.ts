/** Respostas sintéticas da Data API. Nenhum dado de produção. */

export const GA4_PROPERTY_TIME_ZONE = {
  timeZone: "America/Sao_Paulo",
  name: "properties/123456789",
};

export const GA4_PAGES_REPORT = {
  kind: "analyticsData#runReport",
  dimensionHeaders: [{ name: "pagePath" }],
  metricHeaders: [
    { name: "screenPageViews", type: "TYPE_INTEGER" },
    { name: "activeUsers", type: "TYPE_INTEGER" },
  ],
  rows: [
    {
      dimensionValues: [{ value: "/blog/artigo?utm_source=ads&utm_medium=cpc" }],
      metricValues: [{ value: "7" }, { value: "7" }],
    },
    {
      dimensionValues: [{ value: "/blog/artigo" }],
      metricValues: [{ value: "3" }, { value: "2" }],
    },
    {
      dimensionValues: [{ value: "/blog" }],
      metricValues: [{ value: "4" }, { value: "4" }],
    },
  ],
  totals: [{ metricValues: [{ value: "14" }, { value: "10" }] }],
  rowCount: 3,
  metadata: { currencyCode: "BRL", timeZone: "America/Sao_Paulo" },
};

export const GA4_SERIES_REPORT = {
  kind: "analyticsData#runReport",
  dimensionHeaders: [{ name: "pagePath" }, { name: "date" }],
  metricHeaders: [{ name: "screenPageViews", type: "TYPE_INTEGER" }],
  rows: [
    {
      dimensionValues: [{ value: "/blog/artigo" }, { value: "20261103" }],
      metricValues: [{ value: "6" }],
    },
    {
      dimensionValues: [{ value: "/blog/artigo?utm_source=ads" }, { value: "20261104" }],
      metricValues: [{ value: "4" }],
    },
    {
      dimensionValues: [{ value: "/blog" }, { value: "20261104" }],
      metricValues: [{ value: "4" }],
    },
  ],
  totals: [{ metricValues: [{ value: "14" }] }],
  rowCount: 3,
  metadata: { currencyCode: "BRL", timeZone: "America/Sao_Paulo" },
};

export const GA4_SOURCES_REPORT = {
  kind: "analyticsData#runReport",
  dimensionHeaders: [{ name: "pagePath" }, { name: "sessionSource" }, { name: "sessionMedium" }],
  metricHeaders: [{ name: "screenPageViews", type: "TYPE_INTEGER" }],
  rows: [
    {
      dimensionValues: [{ value: "/blog/artigo" }, { value: "google" }, { value: "organic" }],
      metricValues: [{ value: "9" }],
    },
    {
      dimensionValues: [{ value: "/blog?utm_source=news" }, { value: "newsletter" }, { value: "email" }],
      metricValues: [{ value: "5" }],
    },
  ],
  totals: [{ metricValues: [{ value: "14" }] }],
  rowCount: 2,
  metadata: { currencyCode: "BRL", timeZone: "America/Sao_Paulo" },
};

export const GA4_SERIES_TRUNCATED_REPORT = {
  ...GA4_SERIES_REPORT,
  rows: GA4_SERIES_REPORT.rows.slice(0, 1),
  rowCount: 10001,
};

export const GA4_PAGES_WITH_DRAFT_REPORT = {
  ...GA4_PAGES_REPORT,
  rows: [
    ...GA4_PAGES_REPORT.rows,
    {
      dimensionValues: [{ value: "/blog/rascunho-secreto" }],
      metricValues: [{ value: "9" }, { value: "1" }],
    },
  ],
  totals: [{ metricValues: [{ value: "23" }, { value: "12" }] }],
  rowCount: 4,
};
