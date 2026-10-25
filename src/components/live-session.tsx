"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertCircle, Monitor, MonitorOff, Radio, Shield, Square, Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requestCoach } from "@/lib/coach/client";
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
import { canUseSpeech, cancelSpeech, speakCoachLine, unlockSpeech } from "@/lib/live-speech";
import type { GameId } from "@/lib/games";

const ANTI_CHEAT_COPY =
  "VALORANTのVanguardなど、チート対策が画面キャプチャをブロックすると真っ黒になるか、共有自体が失敗します。その環境ではライブコーチは動きません。";
const WINDOWED_COPY =
  "ゲームはフルスクリーン専有ではなく、ボーダーレスまたはウィンドウ表示にしてください。コーチングは声です。ゲーム画面の上には何も描きません。このタブを見なくても大丈夫です。";

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
  const [warning, setWarning] = useState("");
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
  const configRef = useRef({ game, rank, character, concern, language });
  const captureOk = useSyncExternalStore(() => () => undefined, canCaptureDisplay, () => false);
  const speechOk = useSyncExternalStore(() => () => undefined, canUseSpeech, () => false);
  configRef.current = { game, rank, character, concern, language };
  const chrome = liveChrome(language);

  useEffect(() => {
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
    setWarning("");
    setLastLine("");
    setSpeaking(false);
    setWatching(false);
    recentPrints.current = [];
    recentLabels.current = [];
    mapPoiRef.current = undefined;
    if (!captureOk) {
      setError("このブラウザでは画面共有が使えません。PCの Chrome または Edge で開いてください。スマホではライブコーチは使えません。");
      setStatus("error");
      return;
    }
    const unlocked = unlockSpeech(configRef.current.language);
    setAudioUnlocked(unlocked || canUseSpeech());
    if (!canUseSpeech()) {
      setWarning(
        language === "en"
          ? "This browser cannot speak. Open Chrome or Edge for English TTS."
          : "このブラウザは音声合成に対応していません。Chrome または Edge で開くと、日本語で話せます。",
      );
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
        setError("画面共有が終了しました。続ける場合は、ゲームウィンドウをウィンドウ表示またはボーダーレスにして再共有してください。");
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
        setWarning(
          `共有画面がほぼ真っ黒です。${ANTI_CHEAT_COPY} ゲームをウィンドウ表示またはボーダーレスにし、このタブではなくゲーム側を選んでください。`,
        );
      }
    } else {
      blackStreak.current = 0;
      setWarning("");
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
          concern: input.concern.trim() || `${input.rank}の${input.character}として今の画面の次の動きを教えてください`,
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
        setError(reason instanceof Error ? reason.message : "ライブ解析に失敗しました。");
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

  return (
    <div className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
      <Card className="border-white/[0.08] bg-[#0e0e10]/95 p-0 text-white shadow-2xl shadow-black/40">
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">PCライブ · 音声コーチ</p>
              <p className="mt-1 text-[11px] text-zinc-600">デスクトップ向け。タブも通知も出しません。声だけです。</p>
            </div>
            {sharing && (
              <Badge className="border border-red-500/20 bg-red-500/10 text-[10px] text-red-300">
                <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-red-400" />
                Sharing
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
                aria-label="画面共有プレビュー"
              />
              {!sharing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#070708] px-6 text-center">
                  <Monitor className="size-8 text-red-400" />
                  <p className="text-sm font-medium">ゲームのウィンドウまたは画面を共有</p>
                  <p className="text-[11px] leading-5 text-zinc-600">このコーチング用タブではなく、プレイ中のゲームを選んでください。</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-5 text-zinc-500">
            <p>{WINDOWED_COPY}</p>
            <p>{ANTI_CHEAT_COPY}</p>
            <p>{chrome.gesture}</p>
          </div>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] p-3 text-xs leading-5 text-red-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
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
            画面は高頻度でJPEGとして送ります。話すのは戦闘後と膠着の詰めだけです。キーはブラウザに出しません。
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
              {captureOk ? "試合中は声だけ聞いていればいい" : "この端末ではライブキャプチャに非対応です"}
            </p>
            <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">
              {captureOk
                ? "戦闘が終わったあと、または膠着で詰めを考えるときだけ話します。種類タブも通知も出しません。音声を出すには、画面共有ボタンを押してください。"
                : "PCの Chrome / Edge で開いてください。iPhone / iPad と多くのモバイルブラウザでは getDisplayMedia が使えません。"}
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
              {speaking ? "SPEAKING" : watching ? "WATCHING" : "LIVE"} · tick {tick}
              {audioUnlocked && speechOk ? " · AUDIO" : ""}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
