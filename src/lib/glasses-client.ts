import { normalizePairCode, type GlassesRole, type GlassesView } from "./glasses-session.ts";

export const GLASSES_CODE_KEY = "vodcoach.glasses.code";

export async function glassesRequest(body: Record<string, unknown>): Promise<GlassesView> {
  const response = await fetch("/api/glasses/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object" || !("code" in data)) {
    throw new Error("glasses");
  }
  return data as GlassesView;
}

export async function fetchGlassesSession(code: string, role?: GlassesRole): Promise<GlassesView | null> {
  const params = new URLSearchParams({ code });
  if (role) params.set("role", role);
  const response = await fetch(`/api/glasses/session?${params}`, { cache: "no-store" });
  if (response.status === 404) return null;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object" || !("canvas" in data)) {
    throw new Error("glasses");
  }
  return data as GlassesView;
}

/** Live coaching pushes the spoken line when a pair code is saved on this browser. */
export async function pushGlassesCue(line: string) {
  if (typeof window === "undefined") return;
  const code = normalizePairCode(window.localStorage.getItem(GLASSES_CODE_KEY));
  if (!code || !line.trim()) return;
  try {
    await glassesRequest({ action: "line", code, line });
  } catch {
    // Voice coaching still speaks when the glasses session is down.
  }
}
