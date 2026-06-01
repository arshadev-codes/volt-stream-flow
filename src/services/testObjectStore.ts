/**
 * Dummy "database" for test objects + reports.
 * Persists to localStorage as JSON. Architecture mirrors a real REST/DB layer
 * so swapping to Supabase or a backend later only changes this file.
 */
import type { TestObject, TestReport, TestStatus } from "@/types/testObject";

const OBJ_KEY = "esa.testObjects.v1";
const REP_KEY = "esa.testReports.v1";

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value, null, 2));
  } catch {}
}

/* ---------------- Test objects ---------------- */

export function listObjects(): TestObject[] {
  return read<TestObject[]>(OBJ_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function getObject(id: string): TestObject | undefined {
  return listObjects().find((o) => o.id === id);
}

export function createObject(
  input: Omit<TestObject, "id" | "createdAt" | "status">,
): TestObject {
  const all = listObjects();
  const obj: TestObject = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: "pending",
  };
  write(OBJ_KEY, [obj, ...all]);
  emit();
  return obj;
}

export function updateObjectStatus(id: string, status: TestStatus) {
  const all = listObjects().map((o) => (o.id === id ? { ...o, status } : o));
  write(OBJ_KEY, all);
  emit();
}

export function deleteObject(id: string) {
  write(OBJ_KEY, listObjects().filter((o) => o.id !== id));
  // Also drop its report
  write(REP_KEY, listReports().filter((r) => r.objectId !== id));
  emit();
}

/* ---------------- Reports (1 per object) ---------------- */

export function listReports(): TestReport[] {
  return read<TestReport[]>(REP_KEY, []);
}

export function getReport(objectId: string): TestReport | undefined {
  return listReports().find((r) => r.objectId === objectId);
}

export function saveReport(report: TestReport) {
  const others = listReports().filter((r) => r.objectId !== report.objectId);
  write(REP_KEY, [report, ...others]);
  updateObjectStatus(report.objectId, report.status);
  emit();
}

/* ---------------- Subscriptions ---------------- */

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Cross-tab sync
  const onStorage = (e: StorageEvent) => {
    if (e.key === OBJ_KEY || e.key === REP_KEY) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
