const ITEM_TYPES = new Set(["lesson", "module", "course"]);

export type CommerceAnalyticsPayload = {
  currency: "BRL";
  value: number;
  transaction_id: string;
  item_type: "lesson" | "module" | "course";
  item_slug?: string;
};

export function reaisFromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function commerceAnalyticsPayload(input: {
  totalCents: number;
  orderId: string;
  itemType: "LESSON" | "MODULE" | "COURSE";
  itemSlug?: string | null;
}): CommerceAnalyticsPayload {
  const itemType = input.itemType.toLowerCase();
  const payload: CommerceAnalyticsPayload = {
    currency: "BRL",
    value: reaisFromCents(input.totalCents),
    transaction_id: input.orderId,
    item_type: ITEM_TYPES.has(itemType) ? (itemType as CommerceAnalyticsPayload["item_type"]) : "lesson",
  };
  if (input.itemSlug && /^[a-z0-9-]{1,80}$/.test(input.itemSlug)) payload.item_slug = input.itemSlug;
  return payload;
}

export function purchaseDedupeKey(orderId: string): string {
  return `af_purchase_${orderId}`;
}

export function checkoutDedupeKey(orderId: string): string {
  return `af_checkout_${orderId}`;
}
