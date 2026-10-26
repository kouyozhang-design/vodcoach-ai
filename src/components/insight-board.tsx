"use client";

import { useMemo, useState } from "react";
import { InsightCard } from "@/components/insight-card";
import { insightAllLabel, insightTabLabel, insightTypesLabel, type CoachLanguage } from "@/lib/coach-language";
import {
  groupInsightsByTab,
  shouldShowInsightTabs,
  usedInsightTabs,
} from "@/lib/coach/insight-tabs";
import type { CoachInsight, InsightTabId } from "@/lib/coach/types";

type BoardTab = "all" | InsightTabId;

export function InsightBoard({
  insights,
  instant = false,
  language = "ja",
}: {
  insights: CoachInsight[];
  instant?: boolean;
  language?: CoachLanguage;
}) {
  const [tab, setTab] = useState<BoardTab>("all");
  const groups = useMemo(() => groupInsightsByTab(insights), [insights]);
  const showTabs = shouldShowInsightTabs(insights);
  const available = usedInsightTabs(insights);
  const visible = tab === "all" ? insights : groups[tab];
  const active: BoardTab = tab !== "all" && visible.length === 0 ? "all" : tab;
  const shown = active === "all" ? insights : groups[active];

  return (
    <div className="mt-6">
      {showTabs && (
        <div
          role="tablist"
          aria-label={insightTypesLabel(language)}
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabPill
            id="all"
            label={insightAllLabel(language)}
            count={insights.length}
            selected={active === "all"}
            onSelect={() => setTab("all")}
          />
          {available.map((id) => (
            <TabPill
              key={id}
              id={id}
              label={insightTabLabel(id, language)}
              count={groups[id].length}
              selected={active === id}
              onSelect={() => setTab(id)}
            />
          ))}
        </div>
      )}
      <div className={`grid gap-3 sm:grid-cols-2 ${showTabs ? "mt-4" : ""}`}>
        {shown.map((insight, index) => (
          <InsightCard
            key={`${insight.id}-${insight.timestamp ?? index}-${index}`}
            insight={insight}
            index={index}
            instant={instant}
            language={language}
          />
        ))}
      </div>
    </div>
  );
}

function TabPill({
  id,
  label,
  count,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      id={`insight-tab-${id}`}
      onClick={onSelect}
      className={`snap-start shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
        selected
          ? "border-red-500/40 bg-red-500/15 text-red-200"
          : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white"
      }`}
    >
      {label}
      <span className={`ml-1.5 font-mono text-[10px] ${selected ? "text-red-300" : "text-zinc-600"}`}>{count}</span>
    </button>
  );
}
