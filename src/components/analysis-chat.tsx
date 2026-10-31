"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { requestAnalysisChat } from "@/lib/coach/analysis-chat-client";
import { subjectFromShown, type ChatTurn } from "@/lib/coach/analysis-chat-prompt";
import type { CoachLanguage } from "@/lib/coach-language";
import type { CoachResponse } from "@/lib/coach/types";
import { uiCopy } from "@/lib/ui-copy";

export function AnalysisChat({
  analysis,
  language,
  rank,
  concern,
}: {
  analysis: CoachResponse;
  language: CoachLanguage;
  rank: string;
  concern: string;
}) {
  const t = uiCopy(language);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const analysisIdRef = useRef(analysis.analysisId);
  analysisIdRef.current = analysis.analysisId;

  useEffect(() => {
    setMessages([]);
    setDraft("");
    setFailed(false);
    setBusy(false);
  }, [analysis.analysisId]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const sentFor = analysis.analysisId;
    const next: ChatTurn[] = [...messages, { role: "user", text }];
    setMessages(next);
    setDraft("");
    setFailed(false);
    setBusy(true);
    try {
      const reply = await requestAnalysisChat({
        analysis: subjectFromShown(analysis, { rank, concern }),
        language,
        messages: next,
      });
      if (analysisIdRef.current !== sentFor) return;
      setMessages((current) => [...current, { role: "coach", text: reply }]);
    } catch {
      if (analysisIdRef.current !== sentFor) return;
      setMessages(messages);
      setDraft(text);
      setFailed(true);
    } finally {
      if (analysisIdRef.current === sentFor) setBusy(false);
    }
  }

  return (
    <section className="mt-6 border-t border-white/[0.06] pt-5" data-testid="analysis-chat">
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">{t.chatTitle}</p>
      <p className="mt-1 text-[11px] leading-5 text-zinc-600">{t.chatHint}</p>
      {messages.length > 0 ? (
        <ol className="mt-3 space-y-2">
          {messages.map((turn, index) => (
            <li
              key={`${turn.role}-${index}`}
              className={`rounded-xl px-3 py-2 text-sm leading-6 ${turn.role === "user" ? "bg-white/[0.04] text-zinc-200" : "border border-red-500/15 bg-red-500/[0.06] text-zinc-100"}`}
            >
              {turn.text}
            </li>
          ))}
        </ol>
      ) : null}
      <form onSubmit={(event) => void send(event)} className="mt-3 flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t.chatPlaceholder}</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 800))}
            placeholder={t.chatPlaceholder}
            disabled={busy}
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-red-500/60"
          />
        </label>
        <button
          type="submit"
          disabled={busy || draft.trim().length === 0}
          className="h-11 shrink-0 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? t.chatWorking : t.chatSend}
        </button>
      </form>
      {failed ? <p className="mt-2 text-[11px] text-red-300">{t.chatFailed}</p> : null}
    </section>
  );
}
