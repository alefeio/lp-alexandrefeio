"use client";

import { useEffect } from "react";
import { checkoutDedupeKey, commerceAnalyticsPayload, purchaseDedupeKey } from "@/lib/commerce/analytics";
import { trackEvent } from "@/lib/analytics";

export function PurchaseBeacon({
  orderId,
  totalCents,
  itemType,
  itemSlug,
  paid,
}: {
  orderId: string;
  totalCents: number;
  itemType: "LESSON" | "MODULE" | "COURSE";
  itemSlug: string | null;
  paid: boolean;
}) {
  useEffect(() => {
    if (!paid) return;
    const key = purchaseDedupeKey(orderId);
    if (window.sessionStorage.getItem(key)) return;
    trackEvent("purchase_completed", commerceAnalyticsPayload({ totalCents, orderId, itemType, itemSlug }));
    window.sessionStorage.setItem(key, "1");
    window.sessionStorage.removeItem(checkoutDedupeKey(orderId));
  }, [itemSlug, itemType, orderId, paid, totalCents]);
  return null;
}
