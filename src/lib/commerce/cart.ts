"use client";

import { useSyncExternalStore } from "react";

export const CART_STORAGE_KEY = "af_cart_v1";

export type StoredCartLine = { type: "LESSON" | "MODULE" | "COURSE"; id: string };

const empty: StoredCartLine[] = [];
let cachedRaw = "";
let cachedLines: StoredCartLine[] = empty;

export function readStoredCart(raw: string | null): StoredCartLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((line) => {
      if (!line || typeof line !== "object") return [];
      const row = line as { type?: unknown; id?: unknown };
      if (row.type !== "LESSON" && row.type !== "MODULE" && row.type !== "COURSE") return [];
      if (typeof row.id !== "string" || row.id.length < 8 || row.id.length > 40) return [];
      return [{ type: row.type, id: row.id }];
    });
  } catch {
    return [];
  }
}

function publish() {
  window.dispatchEvent(new Event("af-cart"));
}

export function writeStoredCart(lines: StoredCartLine[]) {
  const raw = JSON.stringify(lines);
  window.localStorage.setItem(CART_STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedLines = lines;
  publish();
}

function subscribe(callback: () => void) {
  window.addEventListener("af-cart", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("af-cart", callback);
    window.removeEventListener("storage", callback);
  };
}

function snapshot() {
  const raw = window.localStorage.getItem(CART_STORAGE_KEY) ?? "";
  if (raw === cachedRaw) return cachedLines;
  cachedRaw = raw;
  cachedLines = readStoredCart(raw);
  return cachedLines;
}

export function useStoredCart(): StoredCartLine[] {
  return useSyncExternalStore(subscribe, snapshot, () => empty);
}
