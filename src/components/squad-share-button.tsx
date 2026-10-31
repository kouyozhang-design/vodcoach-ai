"use client";

import { useState } from "react";
import type { CoachLanguage } from "@/lib/coach-language";
import type { CoachResponse } from "@/lib/coach/types";
import { uiCopy } from "@/lib/ui-copy";

async function writeClipboard(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = url;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function SquadShareButton({
  result,
  language,
}: {
  result: CoachResponse;
  language: CoachLanguage;
}) {
  const copy = uiCopy(language);
  const [phase, setPhase] = useState<"idle" | "working" | "copied" | "failed">("idle");

  async function onShare() {
    if (phase === "working") return;
    setPhase("working");
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, result }),
      });
      const payload = (await response.json().catch(() => null)) as { path?: unknown } | null;
      const path = typeof payload?.path === "string" ? payload.path : "";
      if (!response.ok || !path.startsWith("/s/")) {
        setPhase("failed");
        return;
      }
      const url = new URL(path, window.location.origin).href;
      const wrote = await writeClipboard(url);
      setPhase(wrote ? "copied" : "failed");
      if (wrote) window.setTimeout(() => setPhase("idle"), 2000);
    } catch {
      setPhase("failed");
    }
  }

  const label =
    phase === "working" ? copy.squadShareWorking : phase === "copied" ? copy.squadShareCopied : copy.squadShare;

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        data-testid="squad-share"
        title={copy.squadShareTip}
        aria-label={copy.squadShare}
        onClick={() => void onShare()}
        disabled={phase === "working"}
        className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-zinc-300 hover:text-white disabled:opacity-60"
      >
        {label}
      </button>
      {phase === "failed" ? (
        <span role="status" className="max-w-44 text-right text-[10px] leading-4 text-zinc-500">
          {copy.squadShareFailed}
        </span>
      ) : null}
    </span>
  );
}
