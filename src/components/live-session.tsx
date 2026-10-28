"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertCircle, Monitor, MonitorOff, Radio, Shield, Square, Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isAbortError, requestCoach } from "@/lib/coach/client";
import { requestCoachTranslation } from "@/lib/coach/translate-client";
import { decideLiveCue, recentCueLabels, rememberCues } from "@/lib/coach/live-cues";
import type { CoachFrame } from "@/lib/coach/types";
import {
  LIVE_INTERVAL_MS,
  canCaptureDisplay,
  grabJpegFrame,
  isCanvasMostlyBlack,
  liveCaptureErrorMessage,
  startDisplayCapture,
} from "@/lib/live-capture";
import { liveChrome, type CoachLanguage } from "@/lib/coach-language";
import { canUseSpeech, cancelSpeech, primeSpeechVoices, speakCoachLine, unlockSpeech } from "@/lib/live-speech";
import type { GameId } from "@/lib/games";
import { fillTemplate, localizeKnownError, uiCopy } from "@/lib/ui-copy";

type LiveStatus = "idle" | "capturing" | "coaching" | "error";

export function LiveSession({
  game,
  rank,
  character,
  concern,
  language = "ja",
}: {
  game: GameId;
  rank: string;
  character: string;
  concern: string;
  language?: CoachLanguage;
}) {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState("");
  const [warningCode, setWarningCode] = useState<"" | "black" | "speech">("");
  const [lastLine, setLastLine] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [watching, setWatching] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [tick, setTick] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inFlight = useRef(false);
  const cancelled = useRef(false);
  const coachAbort = useRef<AbortController | null>(null);
  const blackStreak = useRef(0);
  const recentPrints = useRef<string[]>([]);
  const recentLabels = useRef<string[]>([]);
  const mapPoiRef = useRef<{ map: string; poi: string } | undefined>(undefined);
  const readOnceRef = useRef<() => Promise<void>>(async () => undefined);
  const lastLineRef = useRef("");
  const spokenLang = useRef(language);
  const configRef = useRef({ game, rank, character, concern, language });
  const captureOk = useSyncExternalStore(() => () => undefined, canCaptureDisplay, () => false);
  const speechOk = useSyncExternalStore(() => () => undefined, canUseSpeech, () => false);
  configRef.current = { game, rank, character, concern, language };
  const chrome = liveChrome(language);
  const t = uiCopy(language);
  const copyRef = useRef(t);
  copyRef.current = t;
  lastLineRef.current = lastLine;
  const warning =
    warningCode === "black"
      ? fillTemplate(t.shareBlack, { anti: t.antiCheat })
      : warningCode === "speech"
        ? t.speechUnsupported
        : "";

  useEffect(() => {
    primeSpeechVoices();
    return () => {
      cancelled.current = true;
      coachAbort.current?.abort();
      cancelSpeech();
      stopStream();
    };
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setSharing(false);
  }

  async function startSharing() {
    setError("");
    setWarningCode("");
    setLastLine("");
    setSpeaking(false);
    setWatching(false);
    recentPrints.current = [];
    recentLabels.current = [];
    mapPoiRef.current = undefined;
    if (!captureOk) {
      setError(copyRef.current.captureUnsupported);
      setStatus("error");
      return;
    }
    const unlocked = unlockSpeech(configRef.current.language);
    setAudioUnlocked(unlocked || canUseSpeech());
    if (!canUseSpeech()) {
      setWarningCode("speech");
    }
    try {
      const stream = await startDisplayCapture();
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (cancelled.current) return;
        cancelSpeech();
        stopStream();
        setStatus("idle");
        setSpeaking(false);
        setError(copyRef.current.shareEnded);
      });
      setSharing(true);
      setStatus("capturing");
      window.setTimeout(() => {
        void readOnce();
      }, 600);
    } catch (reason) {
      setStatus("error");
      setError(liveCaptureErrorMessage(reason));
    }
  }

  function stopSharing() {
    cancelSpeech();
    stopStream();
    setSpeaking(false);
    setStatus("idle");
  }

  function talk(line: string) {
    spokenLang.current = configRef.current.language;
    setLastLine(line);
    if (!canUseSpeech()) {
      setSpeaking(false);
      return;
    }
    const started = speakCoachLine(line, configRef.current.language, {
      onstart: () => {
        if (!cancelled.current) setSpeaking(true);
      },
      onend: () => {
        if (!cancelled.current) setSpeaking(false);
      },
      onerror: () => {
        if (!cancelled.current) setSpeaking(false);
      },
    });
    if (!started) setSpeaking(false);
  }

  async function readOnce() {
    if (inFlight.current || cancelled.current) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || video.readyState < 2) return;

    if (isCanvasMostlyBlack(video)) {
      blackStreak.current += 1;
      if (blackStreak.current >= 2) {
        setWarningCode("black");
      }
    } else {
      blackStreak.current = 0;
      setWarningCode("");
    }

    const first = grabJpegFrame(video);
    if (!first) return;
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    const second = grabJpegFrame(video) ?? first;
    const frames: CoachFrame[] = [
      { timestamp: Date.now() / 1000, mimeType: "image/jpeg", dataUrl: first },
      { timestamp: Date.now() / 1000 + 0.42, mimeType: "image/jpeg", dataUrl: second },
    ];

    inFlight.current = true;
    setStatus("coaching");
    const input = configRef.current;
    coachAbort.current?.abort();
    const run = new AbortController();
    coachAbort.current = run;
    try {
      const payload = await requestCoach(
        {
          game: input.game,
          rank: input.rank,
          character: input.character,
          concern: input.concern.trim() || fillTemplate(copyRef.current.liveConcern, { rank: input.rank, character: input.character }),
          frames,
          mode: "live",
          language: input.language,
          recentCues: recentLabels.current,
          mapPoi: mapPoiRef.current,
        },
        { signal: run.signal },
      );
      if (!cancelled.current) {
        if (payload.mapPoi?.map && payload.mapPoi.poi) {
          mapPoiRef.current = payload.mapPoi;
        }
        const decision = decideLiveCue(payload, recentPrints.current);
        if (decision.speak && decision.spokenLine) {
          recentPrints.current = rememberCues(recentPrints.current, payload.insights, decision.spokenLine);
          recentLabels.current = recentCueLabels(payload.insights, decision.spokenLine);
          setWatching(false);
          setTick((value) => value + 1);
          talk(decision.spokenLine);
        } else {
          setWatching(true);
        }
        setError("");
      }
    } catch (reason) {
      if (!cancelled.current) {
        setError(reason instanceof Error ? reason.message : copyRef.current.liveFailed);
      }
    } finally {
      inFlight.current = false;
      if (!cancelled.current && streamRef.current) setStatus("capturing");
    }
  }
  readOnceRef.current = readOnce;

  useEffect(() => {
    if (!sharing) return;
    const timer = window.setInterval(() => {
      void readOnceRef.current();
    }, LIVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [sharing]);

  useEffect(() => {
    if (spokenLang.current === language) return;
    const line = lastLineRef.current.trim();
    if (!line) {
      spokenLang.current = language;
      return;
    }
    cancelSpeech();
    setSpeaking(false);
    const ac = new AbortController();
    const from = spokenLang.current;
    void requestCoachTranslation(
      {
        language,
        sourceLanguage: from,
        bundle: { headline: line, summary: line, spokenLine: line, insights: [] },
      },
      ac.signal,
    )
      .then((bundle) => {
        if (ac.signal.aborted) return;
        const next = (bundle.spokenLine || line).trim();
        spokenLang.current = language;
        if (next && next !== line) {
          setLastLine(next);
          const started = speakCoachLine(next, language, {
            onstart: () => {
              if (!cancelled.current) setSpeaking(true);
            },
            onend: () => {
              if (!cancelled.current) setSpeaking(false);
            },
            onerror: () => {
              if (!cancelled.current) setSpeaking(false);
            },
          });
          if (!started) setSpeaking(false);
        }
      })
      .catch((reason) => {
        if (ac.signal.aborted || isAbortError(reason)) return;
      });
    return () => ac.abort();
  }, [language]);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
      <Card className="border-white/[0.08] bg-[#0e0e10]/95 p-0 text-white shadow-2xl shadow-black/40">
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t.liveTitle}</p>
              <p className="mt-1 text-[11px] text-zinc-600">{t.liveSubtitle}</p>
            </div>
            {sharing && (
              <Badge className="border border-red-500/20 bg-red-500/10 text-[10px] text-red-300">
                <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-red-400" />
                {t.sharing}
              </Badge>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
            <div className="relative aspect-video">
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="size-full object-contain"
                aria-label={t.sharePreviewAria}
              />
              {!sharing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#070708] px-6 text-center">
                  <Monitor className="size-8 text-red-400" />
                  <p className="text-sm font-medium">{t.sharePrompt}</p>
                  <p className="text-[11px] leading-5 text-zinc-600">{t.sharePromptHint}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-5 text-zinc-500">
            <p>{t.windowed}</p>
            <p>{t.antiCheat}</p>
            <p>{chrome.gesture}</p>
          </div>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] p-3 text-xs leading-5 text-red-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {localizeKnownError(error, language)}
            </div>
          )}
          {warning && !error && (
            <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] p-3 text-xs leading-5 text-amber-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {warning}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            {sharing ? (
              <Button
                type="button"
                onClick={stopSharing}
                className="h-12 flex-1 rounded-xl bg-white text-black hover:bg-zinc-200"
              >
                <Square className="size-4" />
                {chrome.stopShare}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void startSharing()}
                className="h-12 flex-1 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400"
              >
                <Volume2 className="size-4" />
                {chrome.startShare}
              </Button>
            )}
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[9px] text-zinc-700">
            <Shield className="size-3 shrink-0" />
            {t.livePrivacy}
          </p>
        </div>
      </Card>

      <Card className="min-h-[520px] overflow-hidden border-white/[0.08] bg-[#0e0e10]/95 p-0 text-white shadow-2xl shadow-black/40 sm:min-h-[620px]">
        {!sharing && !lastLine && (
          <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-10 text-center sm:min-h-[620px] sm:px-8">
            <div className="relative">
              <div className="absolute -inset-7 rounded-full bg-red-500/10 blur-2xl" />
              <div className="relative grid size-16 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                {captureOk ? <Volume2 className="size-6 text-red-400" /> : <MonitorOff className="size-6 text-zinc-500" />}
              </div>
            </div>
            <p className="mt-6 text-base font-semibold">
              {captureOk ? t.liveIdleTitle : t.liveUnsupportedTitle}
            </p>
            <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">
              {captureOk
                ? t.liveIdleBody
                : t.liveUnsupportedBody}
            </p>
          </div>
        )}

        {(sharing || lastLine) && (
          <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center sm:min-h-[620px]">
            <Radio className={`size-8 text-red-400 ${speaking || status === "coaching" ? "animate-pulse" : ""}`} />
            <p className="mt-6 text-lg font-semibold">
              {speaking ? chrome.speakingNow : watching || sharing ? chrome.watching : chrome.voiceCoach}
            </p>
            <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">
              {speaking
                ? chrome.keepEyesOnGame
                : status === "coaching"
                  ? chrome.stayQuietMidFight
                  : chrome.onlyPostFight}
            </p>
            {lastLine ? (
              <p className="mt-8 max-w-md text-sm leading-6 text-zinc-200" aria-live="polite">
                {lastLine}
              </p>
            ) : null}
            <p className="mt-6 font-mono text-[9px] text-zinc-700">
              {speaking ? t.liveMetaSpeaking : watching ? t.liveMetaWatching : t.liveMetaLive} · {tick}
              {audioUnlocked && speechOk ? ` · ${t.liveMetaAudio}` : ""}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
