import type { LessonBlockData } from "@/lib/learning/blocks";
import { LESSON_01_SLUG, lesson01Blocks, lesson01Meta } from "@/lib/learning/lesson-01";
import { LESSON_02_SLUG, lesson02Blocks, lesson02Meta } from "@/lib/learning/lesson-02";
import { LESSON_03_SLUG, lesson03Blocks, lesson03Meta } from "@/lib/learning/lesson-03";
import { LESSON_04_SLUG, lesson04Blocks, lesson04Meta } from "@/lib/learning/lesson-04";
import { LESSON_05_SLUG, lesson05Blocks, lesson05Meta } from "@/lib/learning/lesson-05";
import { LESSON_06_SLUG, lesson06Blocks, lesson06Meta } from "@/lib/learning/lesson-06";
import { LESSON_07_SLUG, lesson07Blocks, lesson07Meta } from "@/lib/learning/lesson-07";
import { LESSON_08_SLUG, lesson08Blocks, lesson08Meta } from "@/lib/learning/lesson-08";
import { LESSON_09_SLUG, lesson09Blocks, lesson09Meta } from "@/lib/learning/lesson-09";
import { LESSON_10_SLUG, lesson10Blocks, lesson10Meta } from "@/lib/learning/lesson-10";
import { LESSON_11_SLUG, lesson11Blocks, lesson11Meta } from "@/lib/learning/lesson-11";
import { LESSON_12_SLUG, lesson12Blocks, lesson12Meta } from "@/lib/learning/lesson-12";

export const FIRST_COURSE_SLUG = "trafego-pago-na-pratica";
export const DEMO_LESSON_SLUG = LESSON_01_SLUG;

export type SeedBlock = {
  blockKey: string;
  position: number;
  countsForProgress: boolean;
  required: boolean;
  data: LessonBlockData;
};

export type SeedLesson = {
  slug: string;
  title: string;
  summary: string;
  publicPreview: string;
  estimatedMinutes: number;
  sortOrder: number;
  accessType: "FREE" | "PAID";
  priceCents: number | null;
  blocks: SeedBlock[];
};

export type SeedModule = {
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  bundlePriceCents: number | null;
  lessons: SeedLesson[];
};

export const firstCourseSeed = {
  slug: FIRST_COURSE_SLUG,
  title: "Tráfego Pago na Prática para Pequenos Negócios",
  subtitle: "Uma trilha em texto para decidir, anunciar e ler o que aconteceu.",
  description:
    "O curso organiza o caminho de um pequeno negócio que vai anunciar: antes de investir, no Google, no Meta e na leitura do resultado. As aulas são independentes. A ordem é só uma sugestão.",
  bundlePriceCents: 24990,
  modules: [
    {
      slug: "antes-de-investir",
      title: "Antes de investir",
      description: "Entender o mecanismo, escolher o canal e ver se o negócio já tem o que anunciar.",
      sortOrder: 0,
      bundlePriceCents: null,
      lessons: [
        {
          slug: DEMO_LESSON_SLUG,
          title: lesson01Meta.title,
          summary: lesson01Meta.summary,
          publicPreview: lesson01Meta.publicPreview,
          estimatedMinutes: lesson01Meta.estimatedMinutes,
          sortOrder: 0,
          accessType: "FREE" as const,
          priceCents: null,
          blocks: lesson01Blocks,
        },
        {
          slug: LESSON_02_SLUG,
          title: lesson02Meta.title,
          summary: lesson02Meta.summary,
          publicPreview: lesson02Meta.publicPreview,
          estimatedMinutes: lesson02Meta.estimatedMinutes,
          sortOrder: 1,
          accessType: lesson02Meta.accessType,
          priceCents: lesson02Meta.priceCents,
          blocks: lesson02Blocks,
        },
        {
          slug: LESSON_03_SLUG,
          title: lesson03Meta.title,
          summary: lesson03Meta.summary,
          publicPreview: lesson03Meta.publicPreview,
          estimatedMinutes: lesson03Meta.estimatedMinutes,
          sortOrder: 2,
          accessType: lesson03Meta.accessType,
          priceCents: lesson03Meta.priceCents,
          blocks: lesson03Blocks,
        },
      ],
    },
    {
      slug: "planeje-antes-de-anunciar",
      title: "Planeje antes de anunciar",
      description: "Objetivo, oferta, orçamento, destino e mensuração.",
      sortOrder: 1,
      bundlePriceCents: 5790,
      lessons: [
        {
          slug: LESSON_04_SLUG,
          title: lesson04Meta.title,
          summary: lesson04Meta.summary,
          publicPreview: lesson04Meta.publicPreview,
          estimatedMinutes: lesson04Meta.estimatedMinutes,
          sortOrder: 0,
          accessType: lesson04Meta.accessType,
          priceCents: lesson04Meta.priceCents,
          blocks: lesson04Blocks,
        },
        {
          slug: LESSON_05_SLUG,
          title: lesson05Meta.title,
          summary: lesson05Meta.summary,
          publicPreview: lesson05Meta.publicPreview,
          estimatedMinutes: lesson05Meta.estimatedMinutes,
          sortOrder: 1,
          accessType: lesson05Meta.accessType,
          priceCents: lesson05Meta.priceCents,
          blocks: lesson05Blocks,
        },
      ],
    },
    {
      slug: "google-ads-na-pratica",
      title: "Google Ads na prática",
      description: "Pesquisa, palavras-chave e anúncio alinhado ao contato.",
      sortOrder: 2,
      bundlePriceCents: 10390,
      lessons: [
        {
          slug: LESSON_06_SLUG,
          title: lesson06Meta.title,
          summary: lesson06Meta.summary,
          publicPreview: lesson06Meta.publicPreview,
          estimatedMinutes: lesson06Meta.estimatedMinutes,
          sortOrder: 0,
          accessType: lesson06Meta.accessType,
          priceCents: lesson06Meta.priceCents,
          blocks: lesson06Blocks,
        },
        {
          slug: LESSON_07_SLUG,
          title: lesson07Meta.title,
          summary: lesson07Meta.summary,
          publicPreview: lesson07Meta.publicPreview,
          estimatedMinutes: lesson07Meta.estimatedMinutes,
          sortOrder: 1,
          accessType: lesson07Meta.accessType,
          priceCents: lesson07Meta.priceCents,
          blocks: lesson07Blocks,
        },
        {
          slug: LESSON_08_SLUG,
          title: lesson08Meta.title,
          summary: lesson08Meta.summary,
          publicPreview: lesson08Meta.publicPreview,
          estimatedMinutes: lesson08Meta.estimatedMinutes,
          sortOrder: 2,
          accessType: lesson08Meta.accessType,
          priceCents: lesson08Meta.priceCents,
          blocks: lesson08Blocks,
        },
      ],
    },
    {
      slug: "meta-ads-na-pratica",
      title: "Meta Ads na prática",
      description: "Objetivo, público e campanhas para lead ou WhatsApp.",
      sortOrder: 3,
      bundlePriceCents: 7190,
      lessons: [
        {
          slug: LESSON_09_SLUG,
          title: lesson09Meta.title,
          summary: lesson09Meta.summary,
          publicPreview: lesson09Meta.publicPreview,
          estimatedMinutes: lesson09Meta.estimatedMinutes,
          sortOrder: 0,
          accessType: lesson09Meta.accessType,
          priceCents: lesson09Meta.priceCents,
          blocks: lesson09Blocks,
        },
        {
          slug: LESSON_10_SLUG,
          title: lesson10Meta.title,
          summary: lesson10Meta.summary,
          publicPreview: lesson10Meta.publicPreview,
          estimatedMinutes: lesson10Meta.estimatedMinutes,
          sortOrder: 1,
          accessType: lesson10Meta.accessType,
          priceCents: lesson10Meta.priceCents,
          blocks: lesson10Blocks,
        },
      ],
    },
    {
      slug: "entenda-e-melhore",
      title: "Entenda e melhore os resultados",
      description: "Ler o número certo e decidir o que mudar.",
      sortOrder: 4,
      bundlePriceCents: 6790,
      lessons: [
        {
          slug: LESSON_11_SLUG,
          title: lesson11Meta.title,
          summary: lesson11Meta.summary,
          publicPreview: lesson11Meta.publicPreview,
          estimatedMinutes: lesson11Meta.estimatedMinutes,
          sortOrder: 0,
          accessType: lesson11Meta.accessType,
          priceCents: lesson11Meta.priceCents,
          blocks: lesson11Blocks,
        },
        {
          slug: LESSON_12_SLUG,
          title: lesson12Meta.title,
          summary: lesson12Meta.summary,
          publicPreview: lesson12Meta.publicPreview,
          estimatedMinutes: lesson12Meta.estimatedMinutes,
          sortOrder: 1,
          accessType: lesson12Meta.accessType,
          priceCents: lesson12Meta.priceCents,
          blocks: lesson12Blocks,
        },
      ],
    },
  ] as SeedModule[],
};
