/**
 * Thin HTTP client targeting the user-hosted MySQL-backed API.
 * The backend reference implementation lives in /server-mysql.
 *
 * Set VITE_API_BASE_URL to point at it, e.g.
 *   VITE_API_BASE_URL=http://localhost:4000
 *
 * When unset, the store falls back to localStorage so the app keeps
 * working without a backend.
 */
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export const isApiEnabled = () => BASE.length > 0;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error("VITE_API_BASE_URL is not set");
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listObjects: () => request<any[]>("/api/test-objects"),
  getObject: (id: number | string) => request<any>(`/api/test-objects/${id}`),
  createObject: (body: any) =>
    request<any>("/api/test-objects", { method: "POST", body: JSON.stringify(body) }),
  updateObject: (id: number | string, body: any) =>
    request<any>(`/api/test-objects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteObject: (id: number | string) =>
    request<{ ok: true }>(`/api/test-objects/${id}`, { method: "DELETE" }),
  saveResults: (id: number | string, body: { raw_result: string; analysis_result: string }) =>
    request<any>(`/api/test-objects/${id}/results`, { method: "POST", body: JSON.stringify(body) }),
};
