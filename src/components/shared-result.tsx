import { FightExpanders } from "@/components/fight-expanders";
import { InsightBoard } from "@/components/insight-board";
import { ViralScriptBlock } from "@/components/viral-script-block";
import { Badge } from "@/components/ui/badge";
import { gameConfigs } from "@/lib/games";
import type { ShareSnapshot } from "@/lib/share-snapshot";
import { uiCopy } from "@/lib/ui-copy";

export function SharedResult({ snapshot }: { snapshot: ShareSnapshot }) {
  const copy = uiCopy(snapshot.language);
  const result = snapshot.result;
  const gameName = gameConfigs[result.game].name;
  const kind =
    result.kind === "match" ? copy.badgeMatch : result.kind === "notes" ? copy.badgeNotes : copy.badgeClip;

  return (
    <main className="min-h-screen bg-[#070708] text-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-[15px] font-bold tracking-[-0.03em]">
          VODCoach<span className="text-red-500">.AI</span>
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
          {gameName}
          {result.character ? ` · ${result.character}` : ""}
        </p>
        <article className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e10]">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{result.headline}</p>
              <p className="mt-1 font-mono text-[9px] text-zinc-700">ANALYSIS · {result.analysisId.slice(0, 8).toUpperCase()}</p>
            </div>
            <Badge className="border border-emerald-500/15 bg-emerald-500/10 text-[9px] text-emerald-400">{kind}</Badge>
          </div>
          <div className="p-5 sm:p-6">
            {result.summary ? <p className="text-sm leading-6 text-zinc-300">{result.summary}</p> : null}
            {result.rotationStory ? (
              <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.022] p-4">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-red-400">{copy.matchRotation}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{result.rotationStory}</p>
              </div>
            ) : null}
            {result.insights.length === 0 ? (
              <p className="mt-6 text-sm leading-6 text-zinc-500">{copy.noInsights}</p>
            ) : (
              <InsightBoard insights={result.insights} instant={result.insights.length > 6} language={snapshot.language} />
            )}
            {result.viralScript ? <ViralScriptBlock script={result.viralScript} language={snapshot.language} /> : null}
            <FightExpanders fights={result.closeRangeFights ?? []} language={snapshot.language} />
          </div>
        </article>
      </div>
    </main>
  );
}
