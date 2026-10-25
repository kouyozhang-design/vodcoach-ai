"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_COACH_LANGUAGE, readStoredLanguage, type CoachLanguage } from "@/lib/coach-language";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("vodcoach-language", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("vodcoach-language", onStoreChange);
  };
}

export function useCoachLanguage(): CoachLanguage {
  return useSyncExternalStore(subscribe, readStoredLanguage, () => DEFAULT_COACH_LANGUAGE);
}
