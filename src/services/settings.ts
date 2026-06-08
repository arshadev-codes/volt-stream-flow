/**
 * App-wide user settings (persisted in localStorage).
 * Currently exposes the "store raw data" toggle which controls whether
 * the high-frequency raw 0.25 ms stream is persisted with each report.
 */

const KEY = "esa.settings.v1";

export interface AppSettings {
  storeRawData: boolean;
}

const DEFAULTS: AppSettings = {
  storeRawData: false,
};

type Listener = (s: AppSettings) => void;
const listeners = new Set<Listener>();

function read(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULTS;
  }
}

let cache = read();

export function getSettings(): AppSettings {
  return cache;
}

export function updateSettings(patch: Partial<AppSettings>) {
  cache = { ...cache, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  listeners.forEach((l) => l(cache));
}

export function subscribeSettings(l: Listener): () => void {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) { cache = read(); l(cache); }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
