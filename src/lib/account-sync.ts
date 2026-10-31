import { deleteAccountAnalysis, putAccountAnalysis, fetchAccountAnalyses } from "./account-analyses-client.ts";
import { planAccountSync, recordFromAccount } from "./account-analyses.ts";
import {
  deleteSavedCoaching,
  getSavedCoaching,
  listSavedRecords,
  putSavedCoaching,
  type SavedCoachingMedia,
  type SavedCoachingRecord,
} from "./saved-coaching.ts";

const DELETED_KEY = "vodcoach.deletedAnalyses";

function readDeletedIds() {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(DELETED_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeDeletedIds(ids: string[]) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(DELETED_KEY, JSON.stringify(ids));
}

/** Remember a signed-in delete that did not reach the account, so the next sync retries it. */
export function markAccountDeleted(id: string) {
  writeDeletedIds([...new Set([...readDeletedIds(), id])]);
}

/** Writes IndexedDB, then the signed-in account. A failed account write stays pending for the next sync. */
export async function saveAccountCopy(record: SavedCoachingRecord, media?: SavedCoachingMedia | null) {
  const pending: SavedCoachingRecord = { ...record, pendingAccount: true };
  await putSavedCoaching(pending, media);
  try {
    await putAccountAnalysis(pending);
    const current = await getSavedCoaching(record.id);
    const base = current?.record ?? pending;
    if (base.updatedAt !== pending.updatedAt) return;
    await putSavedCoaching({ ...base, pendingAccount: false, accountCopy: true });
  } catch {
    // The device copy remains, flagged so the next signed-in load retries.
  }
}

/** Pulls this account's rows into IndexedDB and retries rows saved while signed in. */
export async function syncAccountAnalyses() {
  const remote = await fetchAccountAnalyses();
  if (!remote) return;
  const stillDeleted: string[] = [];
  for (const id of readDeletedIds()) {
    if (!remote.some((row) => row.id === id)) continue;
    const removed = await deleteAccountAnalysis(id);
    if (!removed) stillDeleted.push(id);
  }
  writeDeletedIds(stillDeleted);
  const hidden = new Set(stillDeleted);
  const visibleRemote = remote.filter((row) => !hidden.has(row.id));
  const local = await listSavedRecords();
  const plan = planAccountSync(local, visibleRemote);
  for (const row of plan.download) {
    const existing = await getSavedCoaching(row.id);
    await putSavedCoaching(recordFromAccount(row, existing?.record ?? null));
  }
  for (const id of plan.dropLocalIds) {
    await deleteSavedCoaching(id);
  }
  const after = await listSavedRecords();
  const retry = planAccountSync(after, visibleRemote);
  for (const row of retry.upload) {
    try {
      await putAccountAnalysis(row);
      const current = await getSavedCoaching(row.id);
      if (!current || current.record.updatedAt !== row.updatedAt) continue;
      await putSavedCoaching({ ...current.record, pendingAccount: false, accountCopy: true }, current.media);
    } catch {
      // Leave pendingAccount set.
    }
  }
}
