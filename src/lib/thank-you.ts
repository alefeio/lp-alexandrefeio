export const THANK_YOU_STORAGE_KEY = "af_thank_you";

export interface ThankYouState {
  firstName?: string;
  confirmationSent?: boolean;
}

export const EMPTY_THANK_YOU_STATE: ThankYouState = {};

let cachedRaw: string | null | undefined;
let cachedState: ThankYouState = EMPTY_THANK_YOU_STATE;

function parseThankYouState(raw: string): ThankYouState {
  try {
    const parsed = JSON.parse(raw) as Partial<ThankYouState>;
    const firstName =
      typeof parsed.firstName === "string" && parsed.firstName.trim()
        ? parsed.firstName.trim().split(/\s+/)[0]
        : undefined;

    if (!firstName && parsed.confirmationSent !== true) return EMPTY_THANK_YOU_STATE;

    return {
      ...(firstName ? { firstName } : {}),
      ...(parsed.confirmationSent === true ? { confirmationSent: true } : {}),
    };
  } catch {
    return EMPTY_THANK_YOU_STATE;
  }
}

export function getThankYouSnapshot(): ThankYouState {
  const raw = sessionStorage.getItem(THANK_YOU_STORAGE_KEY);
  if (raw === cachedRaw) return cachedState;

  cachedRaw = raw;
  cachedState = raw ? parseThankYouState(raw) : EMPTY_THANK_YOU_STATE;
  return cachedState;
}

export function getServerThankYouSnapshot(): ThankYouState {
  return EMPTY_THANK_YOU_STATE;
}

export function subscribeThankYouState(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}
