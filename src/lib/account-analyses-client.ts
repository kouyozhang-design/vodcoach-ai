import { parseAccountRecord } from "./account-analyses.ts";
import type { SavedCoachingRecord } from "./saved-coaching.ts";

/** null means the account store was not reachable. An empty list means this account has no rows. */
export async function fetchAccountAnalyses(): Promise<SavedCoachingRecord[] | null> {
  try {
    const response = await fetch("/api/analyses", { method: "GET", cache: "no-store" });
    if (response.status === 401 || response.status === 503) return null;
    if (!response.ok) return null;
    const body = (await response.json()) as { analyses?: unknown };
    if (!body || !Array.isArray(body.analyses)) return null;
    return body.analyses.flatMap((row) => {
      const parsed = parseAccountRecord(row);
      return parsed ? [parsed] : [];
    });
  } catch {
    return null;
  }
}

export async function putAccountAnalysis(record: SavedCoachingRecord) {
  const response = await fetch("/api/analyses", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!response.ok) throw new Error("account_save_failed");
}

export async function deleteAccountAnalysis(id: string) {
  try {
    const response = await fetch(`/api/analyses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
