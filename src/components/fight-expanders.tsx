"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Swords } from "lucide-react";
import { fightChrome, type CoachLanguage } from "@/lib/coach-language";
import { fightWindowSec, framesInFightWindow } from "@/lib/coach/fight-detail";
import type { CloseRangeFight, CoachFrame } from "@/lib/coach/types";
import { extractJpegFramesInRange } from "@/lib/extract-frames";

const STILL_COUNT = 3;

export function FightExpanders({
  fights,
  language = "ja",
  previewUrl = "",
  videoUrl = "",
  frames,
}: {
  fights: CloseRangeFight[];
  language?: CoachLanguage;
  previewUrl?: string;
  videoUrl?: string;
  frames?: CoachFrame[];
}) {
  if (fights.length === 0) return null;
  const chrome = fightChrome(language);
  const mediaSrc = previewUrl || videoUrl;

  return (
    <section className="mt-8" aria-label={chrome.heading}>
      <div className="flex items-start gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-red-500/10">
          <Swords className="size-4 text-red-400" />
        </div>
        <div>
          <h2 className="text-xs font-semibold">{chrome.heading}</h2>
          <p className="mt-1 text-[10px] leading-4 text-zinc-600">{chrome.hint}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {fights.map((fight) => (
          <FightRow
            key={`${fight.id}-${fight.start}`}
            fight={fight}
            language={language}
            mediaSrc={mediaSrc}
            frames={frames}
          />
        ))}
      </div>
    </section>
  );
}

function FightRow({
  fight,
  language,
  mediaSrc,
  frames,
}: {
  fight: CloseRangeFight;
  language: CoachLanguage;
  mediaSrc: string;
  frames?: CoachFrame[];
}) {
  const [open, setOpen] = useState(false);
  const chrome = fightChrome(language);

  return (
    <details
      className="rounded-2xl border border-white/[0.07] bg-white/[0.022] open:border-red-500/20"
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="font-mono text-[9px] text-zinc-600">
            {fight.start}
            {fight.end && fight.end !== fight.start ? `–${fight.end}` : ""}
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold">{fight.title}</p>
        </div>
        <ChevronDown className={`size-4 shrink-0 text-zinc-600 transition ${open ? "rotate-180 text-red-300" : ""}`} />
      </summary>
      {open ? (
        <div className="space-y-4 border-t border-white/[0.05] px-4 py-4">
          <FightVisual
            key={`${fight.id}-${mediaSrc}-${fight.start}-${fight.end}`}
            fight={fight}
            mediaSrc={mediaSrc}
            frames={frames}
            language={language}
          />
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-red-400">{chrome.sightlines}</p>
            <p className="mt-1.5 text-[11px] leading-5 text-zinc-400">{fight.sightlines}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-red-400">{chrome.knowHow}</p>
            <p className="mt-1.5 text-[11px] leading-5 text-zinc-400">{fight.knowHow}</p>
          </div>
        </div>
      ) : null}
    </details>
  );
}

function FightVisual({
  fight,
  mediaSrc,
  frames,
  language,
}: {
  fight: CloseRangeFight;
  mediaSrc: string;
  frames?: CoachFrame[];
  language: CoachLanguage;
}) {
  const { startSec, endSec } = fightWindowSec(fight);
  const chrome = fightChrome(language);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [extracted, setExtracted] = useState<string[] | null>(null);
  const [extractFailed, setExtractFailed] = useState(false);
  const fallback = useMemo(
    () => framesInFightWindow(frames, fight).map((frame) => frame.dataUrl),
    [frames, fight],
  );
  const stills = extracted && extracted.length > 0 ? extracted : fallback;
  const loading = Boolean(mediaSrc) && extracted === null && !extractFailed;

  useEffect(() => {
    if (!mediaSrc) return;
    let cancelled = false;
    void extractJpegFramesInRange(null, mediaSrc, startSec, endSec, STILL_COUNT)
      .then((framesFromFile) => {
        if (cancelled) return;
        setExtracted(framesFromFile.map((frame) => frame.dataUrl));
      })
      .catch(() => {
        if (!cancelled) setExtractFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaSrc, startSec, endSec]);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !mediaSrc) return;
    let cancelled = false;
    const onReady = () => {
      if (cancelled) return;
      try {
        player.currentTime = startSec;
      } catch {
        /* Safari can reject a seek before metadata */
      }
    };
    const onSeeked = () => {
      if (cancelled) return;
      void player.play().catch(() => undefined);
    };
    const onTime = () => {
      if (player.currentTime >= endSec - 0.05) {
        player.currentTime = startSec;
      }
    };
    player.addEventListener("loadedmetadata", onReady);
    player.addEventListener("seeked", onSeeked);
    player.addEventListener("timeupdate", onTime);
    if (player.readyState >= 1) onReady();
    return () => {
      cancelled = true;
      player.pause();
      player.removeEventListener("loadedmetadata", onReady);
      player.removeEventListener("seeked", onSeeked);
      player.removeEventListener("timeupdate", onTime);
    };
  }, [mediaSrc, startSec, endSec]);

  const showVideo = Boolean(mediaSrc);
  const showStills = stills.length > 0;
  if (!showVideo && !showStills && !loading) {
    return <p className="text-[10px] leading-4 text-zinc-600">{chrome.noMedia}</p>;
  }

  return (
    <div className="space-y-2">
      {showVideo ? (
        <video
          ref={videoRef}
          src={mediaSrc}
          muted
          playsInline
          loop={false}
          preload="metadata"
          className="aspect-video w-full rounded-lg bg-black object-contain"
          aria-label={`${fight.start}–${fight.end}`}
        />
      ) : null}
      {loading ? <p className="text-[10px] text-zinc-600">{chrome.loading}</p> : null}
      {showStills ? (
        <div className="grid grid-cols-3 gap-1.5">
          {stills.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${src.slice(0, 24)}-${index}`}
              src={src}
              alt=""
              className="aspect-video w-full rounded-md bg-black object-cover"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
