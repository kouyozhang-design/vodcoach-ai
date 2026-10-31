"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { InsightBoard } from "@/components/insight-board";
import type { CoachLanguage } from "@/lib/coach-language";
import { coachingView, type SavedCoachingRecord } from "@/lib/saved-coaching";
import { uiCopy } from "@/lib/ui-copy";

export function SavedAnalyses({
  records,
  language,
  onOpen,
  onDelete,
}: {
  records: SavedCoachingRecord[];
  language: CoachLanguage;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = uiCopy(language);
  const [openId, setOpenId] = useState<string | null>(null);

  if (records.length === 0) return null;

  return (
    <ul className="mt-3 divide-y divide-white/[0.06]">
      {records.map((record) => {
        const view = coachingView(record, language);
        const expanded = openId === record.id;
        return (
          <li key={record.id} className="py-2" data-testid="saved-row">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpenId(expanded ? null : record.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-1.5">
                  <ChevronDown className={`size-3.5 shrink-0 text-zinc-600 transition ${expanded ? "rotate-180" : ""}`} />
                  <span className="truncate text-sm text-zinc-200">{view.headline || record.character}</span>
                </span>
                {view.summary ? (
                  <span className="mt-1 block truncate pl-5 text-xs text-zinc-500">{view.summary}</span>
                ) : null}
              </button>
              <button type="button" onClick={() => onOpen(record.id)} className="text-[11px] font-semibold text-zinc-400 hover:text-white">
                {t.savedOpen}
              </button>
              <button
                type="button"
                onClick={() => onDelete(record.id)}
                className="text-[11px] font-semibold text-red-300 hover:text-red-200"
                aria-label={t.savedDelete}
              >
                {t.savedDelete}
              </button>
            </div>
            {expanded ? (
              <div className="mt-3 pl-5" data-testid="saved-coaching">
                {view.summary ? <p className="text-sm leading-6 text-zinc-300">{view.summary}</p> : null}
                {view.rotationStory ? (
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    <span className="mr-2 text-[9px] font-semibold uppercase tracking-wider text-red-400">{t.matchRotation}</span>
                    {view.rotationStory}
                  </p>
                ) : null}
                {view.insights.length === 0 ? (
                  <p className="mt-3 text-sm leading-6 text-zinc-500">{t.noInsights}</p>
                ) : (
                  <InsightBoard insights={view.insights} instant language={language} />
                )}
                {view.closeRangeFights && view.closeRangeFights.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {view.closeRangeFights.map((fight) => (
                      <li key={fight.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm leading-6 text-zinc-300">
                        <p className="font-medium text-zinc-100">{fight.title}</p>
                        <p className="mt-1">{fight.sightlines}</p>
                        <p className="mt-1">{fight.knowHow}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
