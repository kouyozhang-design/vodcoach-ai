import type { CoachLanguage } from "./coach-language.ts";
import type { CoachTextBundle } from "./coach/coach-text.ts";
import type { CoachFrame, CoachResponse } from "./coach/types.ts";
import type { GameId } from "./games.ts";

const DB_NAME = "vodcoach";
const DB_VERSION = 1;
const RESULT_STORE = "results";
const MEDIA_STORE = "media";

export type SavedCoachingRecord = {
  id: string;
  savedAt: number;
  updatedAt: number;
  game: GameId;
  character: string;
  rank: string;
  concern: string;
  sourceLanguage: CoachLanguage;
  result: CoachResponse;
  translations: Partial<Record<CoachLanguage, CoachTextBundle>>;
  videoName?: string;
  remoteVideoUrl?: string;
};

export type SavedCoachingMedia = {
  id: string;
  videoBlob?: Blob;
  frames?: CoachFrame[];
};

export type SavedCoachingSummary = {
  id: string;
  savedAt: number;
  game: GameId;
  character: string;
  rank: string;
  sourceLanguage: CoachLanguage;
  headlines: Partial<Record<CoachLanguage, string>>;
};

export function withTranslation(
  record: SavedCoachingRecord,
  language: CoachLanguage,
  bundle: CoachTextBundle,
): SavedCoachingRecord {
  return {
    ...record,
    updatedAt: Date.now(),
    translations: { ...record.translations, [language]: bundle },
  };
}

export function withoutId<T extends { id: string }>(records: T[], id: string) {
  return records.filter((record) => record.id !== id);
}

export function summaryOf(record: SavedCoachingRecord): SavedCoachingSummary {
  const headlines: Partial<Record<CoachLanguage, string>> = {
    [record.sourceLanguage]: record.translations[record.sourceLanguage]?.headline || record.result.headline,
  };
  for (const language of Object.keys(record.translations) as CoachLanguage[]) {
    const headline = record.translations[language]?.headline;
    if (headline) headlines[language] = headline;
  }
  return {
    id: record.id,
    savedAt: record.savedAt,
    game: record.game,
    character: record.character,
    rank: record.rank,
    sourceLanguage: record.sourceLanguage,
    headlines,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexeddb_unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RESULT_STORE)) db.createObjectStore(RESULT_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_unavailable"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_failed"));
  });
}

export async function listSavedCoaching(): Promise<SavedCoachingSummary[]> {
  try {
    const db = await openDb();
    const rows = await requestToPromise(db.transaction(RESULT_STORE, "readonly").objectStore(RESULT_STORE).getAll());
    db.close();
    return (rows as SavedCoachingRecord[])
      .filter((row) => row && typeof row.id === "string")
      .map(summaryOf)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function getSavedCoaching(id: string): Promise<{ record: SavedCoachingRecord; media: SavedCoachingMedia | null } | null> {
  try {
    const db = await openDb();
    const tx = db.transaction([RESULT_STORE, MEDIA_STORE], "readonly");
    const record = (await requestToPromise(tx.objectStore(RESULT_STORE).get(id))) as SavedCoachingRecord | undefined;
    const media = (await requestToPromise(tx.objectStore(MEDIA_STORE).get(id))) as SavedCoachingMedia | undefined;
    db.close();
    if (!record) return null;
    return { record, media: media ?? null };
  } catch {
    return null;
  }
}

function commitPut(db: IDBDatabase, store: string, value: unknown) {
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexeddb_failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexeddb_failed"));
  });
}

export async function putSavedCoaching(record: SavedCoachingRecord, media?: SavedCoachingMedia | null) {
  const db = await openDb();
  try {
    await commitPut(db, RESULT_STORE, record);
    if (media && (media.videoBlob || (media.frames && media.frames.length > 0))) {
      try {
        await commitPut(db, MEDIA_STORE, { ...media, id: record.id });
      } catch {
        // A quota failure on the video or frames must leave the coaching JSON in place.
      }
    }
  } finally {
    db.close();
  }
}

/** Adds one language onto the existing record. Does not delete the record or its other translations. */
export async function rememberTranslation(id: string, language: CoachLanguage, bundle: CoachTextBundle) {
  const loaded = await getSavedCoaching(id);
  if (!loaded) return;
  const next = withTranslation(loaded.record, language, bundle);
  const db = await openDb();
  const tx = db.transaction(RESULT_STORE, "readwrite");
  tx.objectStore(RESULT_STORE).put(next);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexeddb_failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexeddb_failed"));
  });
  db.close();
}

export async function deleteSavedCoaching(id: string) {
  const db = await openDb();
  const tx = db.transaction([RESULT_STORE, MEDIA_STORE], "readwrite");
  tx.objectStore(RESULT_STORE).delete(id);
  tx.objectStore(MEDIA_STORE).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexeddb_failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexeddb_failed"));
  });
  db.close();
}
