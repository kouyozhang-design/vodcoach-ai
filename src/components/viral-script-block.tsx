"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { viralChrome, type CoachLanguage } from "@/lib/coach-language";
import { formatViralHookCopy, type ViralScript } from "@/lib/coach/viral-script";

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
      await navigator.clipboard.writeText(formatViralHookCopy(script));
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
        <Button type="button" size="sm" onClick={onCopy} data-testid="copy-viral-script">
          {copied ? <Check className="text-emerald-600" /> : <Copy />}
          {copied ? chrome.copied : chrome.copy}
        </Button>
      </div>
      <p className="mt-3 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{chrome.title}</p>
      <p className="mt-1 text-xl font-black leading-tight tracking-tight text-white sm:text-2xl" data-field="video_title">
        {script.video_title}
      </p>
      <p className="mt-3 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{chrome.tsukkomi}</p>
      <p className="mt-1 text-base font-medium leading-6 text-white" data-field="ai_tsukkomi">
        {script.ai_tsukkomi}
      </p>
      {script.cta_text ? <p className="mt-3 text-sm leading-6 text-zinc-500">{script.cta_text}</p> : null}
    </section>
  );
}
