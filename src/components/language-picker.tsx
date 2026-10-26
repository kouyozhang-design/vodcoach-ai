"use client";

import { COACH_LANGUAGES, LANGUAGE_LABELS, parseCoachLanguage, type CoachLanguage } from "@/lib/coach-language";

export function LanguagePicker({
  language,
  label,
  onChange,
}: {
  language: CoachLanguage;
  label: string;
  onChange: (language: CoachLanguage) => void;
}) {
  return (
    <select
      aria-label={label}
      data-testid="language-picker"
      value={language}
      onChange={(event) => onChange(parseCoachLanguage(event.target.value))}
      className="h-7 max-w-[11rem] rounded-full border border-white/[0.08] bg-[#141416] px-2.5 text-[11px] font-semibold text-zinc-100 outline-none"
    >
      {COACH_LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {LANGUAGE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
