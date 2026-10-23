"use client";

import { useEffect, useState } from "react";
import { Crosshair, Flag, Map, ScanLine, Zap } from "lucide-react";
import { insightTabLabel, type CoachLanguage } from "@/lib/coach-language";
import { resolveInsightTab } from "@/lib/coach/insight-tabs";
import type { CoachInsight, InsightTabId } from "@/lib/coach/types";

const tabIcons: Record<InsightTabId, typeof Crosshair> = {
  aim: Crosshair,
  rotation: Map,
  abilities: Zap,
  endgame: Flag,
  other: ScanLine,
};

function Typewriter({ text, delay = 0, instant = false }: { text: string; delay?: number; instant?: boolean }) {
  const [visible, setVisible] = useState("");
  useEffect(() => {
    if (instant) return;
    let index = 0;
    let interval = 0;
    const timeout = window.setTimeout(() => {
      interval = window.setInterval(() => {
        index += 2;
        setVisible(text.slice(0, index));
        if (index >= text.length) window.clearInterval(interval);
      }, 12);
    }, delay);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [delay, instant, text]);
  if (instant) return <>{text}</>;
  return (
    <>
      {visible}
      {visible.length < text.length && (
        <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-red-400 align-middle" />
      )}
    </>
  );
}

export function InsightCard({
  insight,
  index,
  instant = false,
  language = "ja",
}: {
  insight: CoachInsight;
  index: number;
  instant?: boolean;
  language?: CoachLanguage;
}) {
  const tab = resolveInsightTab(insight);
  const Icon = tabIcons[tab];
  const featured = tab === "endgame";
  return (
    <article
      className={`rounded-2xl border p-4 ${featured ? "border-red-500/20 bg-gradient-to-br from-red-500/[0.09] to-transparent" : "border-white/[0.07] bg-white/[0.022]"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-500/10">
          <Icon className="size-4 text-red-400" />
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1">
          <span className="rounded-full border border-white/[0.06] px-2 py-0.5 text-[9px] text-zinc-500">
            {insightTabLabel(tab, language)}
          </span>
          <span className="font-mono text-[9px] text-zinc-700">{insight.timestamp ?? `0${index + 1}`}</span>
        </div>
      </div>
      <h2 className="mt-3 text-xs font-semibold">{insight.title}</h2>
      <p className="mt-2 min-h-10 text-[10px] leading-4 text-zinc-600">
        <Typewriter text={insight.finding} delay={120 + index * 180} instant={instant} />
      </p>
      <div className="mt-3 border-t border-white/[0.05] pt-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-red-400">Coach action</p>
        <p className="mt-1 text-[10px] leading-4 text-zinc-400">
          <Typewriter text={insight.action} delay={320 + index * 180} instant={instant} />
        </p>
      </div>
    </article>
  );
}

export { Typewriter };
