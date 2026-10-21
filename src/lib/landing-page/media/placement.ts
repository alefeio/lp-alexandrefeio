import { z } from "zod";
import {
  LANDING_PAGE_MEDIA_ASPECTS,
  LANDING_PAGE_MEDIA_FITS,
  LANDING_PAGE_MEDIA_LIMITS,
  LANDING_PAGE_MEDIA_POSITIONS,
  LANDING_PAGE_MEDIA_USAGES,
} from "@/lib/landing-page/media/limits";

export const landingPageMediaPlacementSchema = z
  .object({
    mediaId: z.string().trim().min(1).max(64),
    usage: z.enum(LANDING_PAGE_MEDIA_USAGES),
    altText: z.string().trim().min(1).max(LANDING_PAGE_MEDIA_LIMITS.maxAltText).optional(),
    decorative: z.boolean().optional(),
    fit: z.enum(LANDING_PAGE_MEDIA_FITS).optional(),
    position: z.enum(LANDING_PAGE_MEDIA_POSITIONS).optional(),
    aspectRatio: z.enum(LANDING_PAGE_MEDIA_ASPECTS).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.altText && /[<>]/.test(value.altText)) {
      ctx.addIssue({ code: "custom", message: "Texto alternativo inválido.", path: ["altText"] });
    }
  });

export type LandingPageMediaPlacement = z.infer<typeof landingPageMediaPlacementSchema>;
