"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertCircle, Monitor, MonitorOff, Radio, Shield, Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InsightCard } from "@/components/insight-card";
import { requestCoach } from "@/lib/coach/client";
import type { CoachFrame, CoachResponse } from "@/lib/coach/types";
import {
  LIVE_INTERVAL_MS,
  canCaptureDisplay,
  grabJpegFrame,
  isCanvasMostlyBlack,
  liveCaptureErrorMessage,
  startDisplayCapture,
} from "@/lib/live-capture";
import type { GameId } from "@/lib/games";

const ANTI_CHEAT_COPY =
  "VALORANTのVanguardなど、チート対策が画面キャプチャをブロックすると真っ黒になるか、共有自体が失敗します。その環境ではライブコーチは動きません。";
const WINDOWED_COPY =
  "ゲームはフルスクリーン専有ではなく、ボーダーレスまたはウィンドウ表示にしてください。コーチングはこのページのパネルに出ます。ゲーム画面の上には何も描きません。フルスクリーンのままだと、このパネルを見るには第二画面が必要です。";

type LiveStatus = "idle" | "capturing" | "coaching" | "error";

export function LiveSession({
  game,
  rank,
  character,
  concern,
}: {
  game: GameId;
  rank: string;
  character: string;
  concern: string;
}) {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [result, setResult] = useState<CoachResponse | null>(null);
  const [sharing, setSharing] = useState(false);
  const [tick, setTick] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inFlight = useRef(false);
  const cancelled = useRef(false);
  const blackStreak = useRef(0);
  const configRef = useRef({ game, rank, character, concern });
  const captureOk = useSyncExternalStore(() => () => undefined, canCaptureDisplay, () => false);
  configRef.current = { game, rank, character, concern };

  useEffect(() => {
    return () => {
      cancelled.current = true;
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
    setResult(null);
    if (!captureOk) {
      setError("このブラウザでは画面共有が使えません。PCの Chrome または Edge で開いてください。スマホではライブコーチは使えません。");
      setStatus("error");
      return;
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
        stopStream();
        setStatus("idle");
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
    stopStream();
    setStatus("idle");
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
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    const second = grabJpegFrame(video) ?? first;
    const frames: CoachFrame[] = [
      { timestamp: Date.now() / 1000, mimeType: "image/jpeg", dataUrl: first },
      { timestamp: Date.now() / 1000 + 0.7, mimeType: "image/jpeg", dataUrl: second },
    ];

    inFlight.current = true;
    setStatus("coaching");
    const input = configRef.current;
    try {
      const payload = await requestCoach({
        game: input.game,
        rank: input.rank,
        character: input.character,
        concern: input.concern.trim() || `${input.rank}の${input.character}として今の画面の次の動きを教えてください`,
        frames,
        mode: "live",
      });
      if (!cancelled.current) {
        setResult(payload);
        setTick((value) => value + 1);
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

  useEffect(() => {
    if (!sharing) return;
    const timer = window.setInterval(() => {
      void readOnce();
    }, LIVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [sharing]);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
      <Card className="border-white/[0.08] bg-[#0e0e10]/95 p-0 text-white shadow-2xl shadow-black/40">
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">PCライブ · 画面共有</p>
              <p className="mt-1 text-[11px] text-zinc-600">デスクトップ向け。ゲーム内HUDへの重ね描きはありません。</p>
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
                共有を止める
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void startSharing()}
                className="h-12 flex-1 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400"
              >
                <Monitor className="size-4" />
                画面共有を開始
              </Button>
            )}
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[9px] text-zinc-700">
            <Shield className="size-3 shrink-0" />
            共有映像は数秒ごとにJPEGとして解析APIへ送ります。キーはブラウザに出しません。
          </p>
        </div>
      </Card>

      <Card className="min-h-[520px] overflow-hidden border-white/[0.08] bg-[#0e0e10]/95 p-0 text-white shadow-2xl shadow-black/40 sm:min-h-[620px]">
        {!result && status !== "coaching" && (
          <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-10 text-center sm:min-h-[620px] sm:px-8">
            <div className="relative">
              <div className="absolute -inset-7 rounded-full bg-red-500/10 blur-2xl" />
              <div className="relative grid size-16 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                {captureOk ? <Radio className="size-6 text-red-400" /> : <MonitorOff className="size-6 text-zinc-500" />}
              </div>
            </div>
            <p className="mt-6 text-base font-semibold">
              {captureOk ? "プレイしながら、このパネルが更新されます" : "この端末ではライブキャプチャに非対応です"}
            </p>
            <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">
              {captureOk
                ? "画面共有を開始すると、約5秒ごとに今の画面を読んで指摘を差し替えます。ゲームの上にはオーバーレイを出しません。"
                : "PCの Chrome / Edge で開いてください。iPhone / iPad と多くのモバイルブラウザでは getDisplayMedia が使えません。"}
            </p>
          </div>
        )}

        {status === "coaching" && !result && (
          <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center sm:min-h-[620px]">
            <Radio className="size-8 animate-pulse text-red-400" />
            <p className="mt-6 text-lg font-semibold">画面を読んでいます</p>
            <p className="mt-2 text-xs text-zinc-600">最初のコーチングを生成しています。</p>
          </div>
        )}

        {result && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                  <p className="text-sm font-semibold">{result.headline}</p>
                </div>
                <p className="mt-1 pl-3.5 font-mono text-[9px] text-zinc-700">LIVE · tick {tick}</p>
              </div>
              <Badge className="border border-emerald-500/15 bg-emerald-500/10 text-[9px] text-emerald-400">
                {status === "coaching" ? "UPDATING" : "LIVE"}
              </Badge>
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-sm leading-6 text-zinc-300">{result.summary}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {result.insights.map((insight, index) => (
                  <InsightCard key={`${insight.id}-${tick}-${index}`} insight={insight} index={index} instant />
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
