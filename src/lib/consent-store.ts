import { pushConsentDefaults, pushConsentUpdate } from "@/lib/analytics";
import { clearPendingCourseView, flushPendingCourseView } from "@/lib/product-journey/current-view";
import { clearJourneyIdentity } from "@/lib/product-journey/identity";
import {
  CONSENT_STORAGE_KEY,
  parseConsent,
  serializeConsent,
  type ConsentChoice,
  type ConsentState,
} from "@/lib/consent";

export interface ConsentUIState {
  ready: boolean;
  consent: ConsentState | null;
  hasChoice: boolean;
  showBanner: boolean;
  showCustomize: boolean;
  panelKey: number;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const SERVER_STATE: ConsentUIState = {
  ready: false,
  consent: null,
  hasChoice: false,
  showBanner: false,
  showCustomize: false,
  panelKey: 0,
};

let state: ConsentUIState = { ...SERVER_STATE };

let bootstrapped = false;

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: ConsentUIState) {
  state = next;
  emit();
}

export function getConsentUIState(): ConsentUIState {
  return state;
}

export function getServerConsentUIState(): ConsentUIState {
  return SERVER_STATE;
}

export function subscribeConsentUI(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStoredConsent(): ConsentState | null {
  return parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
}

export function bootstrapConsent(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  pushConsentDefaults();

  const stored = readStoredConsent();
  if (stored) {
    pushConsentUpdate(stored);
    setState({
      ready: true,
      consent: stored,
      hasChoice: true,
      showBanner: false,
      showCustomize: false,
      panelKey: 0,
    });
    return;
  }

  setState({
    ready: true,
    consent: null,
    hasChoice: false,
    showBanner: true,
    showCustomize: false,
    panelKey: 0,
  });
}

function persist(next: ConsentState) {
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
  if (!next.analytics) {
    try {
      clearJourneyIdentity(localStorage, sessionStorage);
      clearPendingCourseView();
    } catch {
      // A retirada do consentimento continua mesmo se o armazenamento local falhar.
    }
  } else {
    try {
      flushPendingCourseView(next.updatedAt);
    } catch {
      // O aceite continua mesmo se a visualização atual não puder ser registrada.
    }
  }
  pushConsentUpdate(next);
  setState({
    ...state,
    ready: true,
    consent: next,
    hasChoice: true,
    showBanner: false,
    showCustomize: false,
  });
}

export function acceptAllConsent(): void {
  persist(serializeConsent({ analytics: true, marketing: true }));
}

export function rejectNonEssentialConsent(): void {
  persist(serializeConsent({ analytics: false, marketing: false }));
}

export function saveConsentChoice(choice: ConsentChoice): void {
  persist(serializeConsent(choice));
}

export function openConsentPreferences(): void {
  setState({
    ...state,
    showBanner: true,
    showCustomize: true,
    panelKey: state.panelKey + 1,
  });
}

export function closeConsentBanner(): void {
  setState({
    ...state,
    showBanner: false,
    showCustomize: false,
  });
}
