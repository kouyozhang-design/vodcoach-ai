"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { viralChrome, type CoachLanguage } from "@/lib/coach-language";
import { formatViralScriptCopy, type ViralScript } from "@/lib/coach/viral-script";

export function ViralScriptBlock({
  script,
  language = "ja",
}: {
  script: ViralScript;
  language?: CoachLanguage;
}) {
  const chrome = viralChrome(language);
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(formatViralScriptCopy(script));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.022] p-4"
      aria-label={chrome.heading}
      data-testid="viral-script"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-red-400">{chrome.heading}</p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          {copied ? chrome.copied : chrome.copy}
        </button>
      </div>
      <p className="mt-3 text-xl font-black leading-tight tracking-tight text-white sm:text-2xl">{script.video_title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-200">{script.ai_tsukkomi}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{script.cta_text}</p>
    </section>
  );
}
