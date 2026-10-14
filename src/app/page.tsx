"use client";

import {
  ChangeEvent, DragEvent, useEffect, useRef, useState,
} from "react";
import {
  AlertCircle, Check, ChevronDown, Crosshair, Dumbbell, FileVideo,
  Gamepad2, LoaderCircle, Play, ScanLine, Shield, Sparkles, UploadCloud,
  X, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { CoachInsight, CoachResponse } from "@/lib/coach/types";
import { gameConfigs, gameIds, type GameId } from "@/lib/games";
import { isAllowedCoachVideo, normalizeCoachVideo } from "@/lib/video";

const MAX_BYTES = 100 * 1024 * 1024;
const insightIcons = { aim: Crosshair, positioning: Shield, abilities: Zap, practice: Dumbbell };

function Typewriter({ text, delay = 0 }: { text: string; delay?: number }) {
  const [visible, setVisible] = useState("");
  useEffect(() => {
    let index = 0;
    let interval = 0;
    const timeout = window.setTimeout(() => {
      interval = window.setInterval(() => {
        index += 2;
        setVisible(text.slice(0, index));
        if (index >= text.length) window.clearInterval(interval);
      }, 12);
    }, delay);
    return () => { window.clearTimeout(timeout); window.clearInterval(interval); };
  }, [delay, text]);
  return <>{visible}{visible.length < text.length && <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-red-400 align-middle" />}</>;
}

function SelectField({
  label, value, options, onChange,
}: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 pr-10 text-sm text-zinc-200 outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10"
          aria-label={label}
        >
          {options.map((option) => <option key={option}>{option}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-zinc-600" />
      </div>
    </label>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [game, setGame] = useState<GameId>("apex-legends");
  const [rank, setRank] = useState(gameConfigs["apex-legends"].defaultRank);
  const [character, setCharacter] = useState(gameConfigs["apex-legends"].defaultCharacter);
  const [concern, setConcern] = useState(gameConfigs["apex-legends"].defaultConcern);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"empty" | "ready" | "analyzing" | "complete" | "error">("empty");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CoachResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef("");
  const gameConfig = gameConfigs[game];
  const canSubmit = concern.trim().length >= 8 && status !== "analyzing";

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  function acceptVideo(nextFile: File) {
    setError("");
    if (!isAllowedCoachVideo(nextFile)) {
      setError("MP4、WebM、MOV形式の動画を選択してください。");
      setStatus("error");
      return;
    }
    if (nextFile.size > MAX_BYTES) {
      setError("動画は100MB以下にしてください。");
      setStatus("error");
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const nextUrl = URL.createObjectURL(nextFile);
    urlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    setFile(nextFile);
    setResult(null);
    setStatus("ready");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (nextFile) acceptVideo(nextFile);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) acceptVideo(nextFile);
  }

  function clearVideo() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
    setPreviewUrl("");
    setFile(null);
    setResult(null);
    setError("");
    setStatus("empty");
    if (inputRef.current) inputRef.current.value = "";
  }

  function changeGame(nextGame: string) {
    const gameId = nextGame as GameId;
    const nextConfig = gameConfigs[gameId];
    setGame(gameId);
    setRank(nextConfig.defaultRank);
    setCharacter(nextConfig.defaultCharacter);
    setConcern(nextConfig.defaultConcern);
    setResult(null);
    setError("");
    setStatus(file ? "ready" : "empty");
  }

  async function submit() {
    if (concern.trim().length < 8) {
      setError("悩みを8文字以上で入力してください。動画は任意です。");
      setStatus("error");
      return;
    }
    setError("");
    setResult(null);
    setProgress(4);
    setStatus("analyzing");
    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(current + Math.max(1, (96 - current) * 0.07), 96));
    }, 90);
    try {
      const trimmedConcern = concern.trim();
      let response: Response;
      if (file) {
        const body = new FormData();
        body.append("video", normalizeCoachVideo(file));
        body.append("game", game);
        body.append("rank", rank);
        body.append("character", character);
        body.append("concern", trimmedConcern);
        response = await fetch("/api/coach", { method: "POST", body });
      } else {
        response = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game, rank, character, concern: trimmedConcern }),
        });
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "解析に失敗しました。");
      setProgress(100);
      setResult(payload as CoachResponse);
      window.setTimeout(() => setStatus("complete"), 260);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "解析に失敗しました。");
      setStatus("error");
    } finally {
      window.clearInterval(timer);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070708] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.18),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative mx-auto max-w-[1480px] px-4 pb-10 sm:px-6 lg:px-10">
        <header className="flex h-18 items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-red-500 to-red-800 shadow-[0_0_28px_rgba(239,68,68,.3)]">
              <span className="absolute -right-1 -top-2 text-2xl font-black italic text-white/15">A</span>
              <Gamepad2 className="relative size-5" />
            </div>
            <div><p className="text-[15px] font-bold tracking-[-0.03em]">VODCoach<span className="text-red-500">.AI</span></p><p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">Multigame intelligence</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="border border-red-500/15 bg-red-500/10 text-[10px] text-red-300"><span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-red-400" />Analyzer online</Badge>
            <span className="hidden text-[10px] text-zinc-700 sm:inline">Prototype · Local mock</span>
          </div>
        </header>

        <section className="pb-7 pt-9 sm:pt-12">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-red-400"><ScanLine className="size-3.5" />Clip or notes coaching</div>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.05em] sm:text-5xl lg:text-[58px]">
            ゲームを問わず、<span className="inline-block bg-gradient-to-r from-red-300 via-red-500 to-orange-400 bg-clip-text text-transparent">映像から改善。</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-500">Apex LegendsとVALORANTに対応。動画は任意です。ゲーム・ランク・キャラ・悩みだけでも、エイム・射線・スキルの改善策を返せます。</p>
        </section>

        <div className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
          <Card className="border-white/[0.08] bg-[#0e0e10]/95 p-0 text-white shadow-2xl shadow-black/40">
            <div className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">01 · Match clip <span className="font-normal text-zinc-500">（任意）</span></p>
                  <p className="mt-1 text-[11px] text-zinc-600">なくても解析できます · MP4 / WebM / MOV · 最大100MB</p>
                </div>
                {file && <button type="button" onClick={clearVideo} className="grid size-8 place-items-center rounded-lg text-zinc-600 transition hover:bg-white/5 hover:text-white" aria-label="動画を削除"><X className="size-4" /></button>}
              </div>

              {!previewUrl ? (
                <div
                  onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`group flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center transition sm:min-h-52 ${dragging ? "border-red-400 bg-red-500/10" : "border-white/10 bg-black/20 hover:border-red-500/40 hover:bg-red-500/[0.035]"}`}
                >
                  <div className="grid size-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-lg shadow-black/30"><UploadCloud className="size-5 text-red-400 transition group-hover:-translate-y-0.5" /></div>
                  <p className="mt-4 text-sm font-medium">動画をドロップ、または選択（任意）</p>
                  <p className="mt-1.5 text-[11px] text-zinc-600">{gameConfig.uploadHint}。なくても下の項目だけでコーチングできます。</p>
                  <Button type="button" size="sm" className="mt-4 bg-white text-black hover:bg-zinc-200">ファイルを選ぶ</Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
                  <div className="relative aspect-video">
                    <video src={previewUrl} controls playsInline className="size-full object-contain" aria-label="アップロード動画プレビュー" />
                    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[9px] uppercase tracking-wider text-red-300 backdrop-blur"><span className="size-1.5 rounded-full bg-red-500" />Preview ready</div>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2 text-[10px] text-zinc-500"><FileVideo className="size-3.5 shrink-0 text-red-400" /><span className="truncate">{file?.name}</span></span>
                    <span className="ml-3 shrink-0 text-[10px] text-zinc-700">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}</span>
                  </div>
                </div>
              )}
              <label className="mt-5 block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">Game</span>
                <div className="relative">
                  <select value={game} onChange={(event) => changeGame(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 pr-10 text-sm text-zinc-200 outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10" aria-label="Game">
                    {gameIds.map((gameId) => <option key={gameId} value={gameId}>{gameConfigs[gameId].name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-zinc-600" />
                </div>
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <SelectField label="Rank" value={rank} options={gameConfig.ranks} onChange={setRank} />
                <SelectField label={gameConfig.characterLabel} value={character} options={gameConfig.characters} onChange={setCharacter} />
              </div>
              <label className="mt-4 block space-y-2">
                <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">Current struggle <span className="font-normal normal-case tracking-normal text-zinc-700">{concern.length}/240</span></span>
                <Textarea value={concern} onChange={(event) => setConcern(event.target.value.slice(0, 240))} className="min-h-24 resize-none border-white/[0.08] bg-white/[0.035] text-sm leading-5 text-zinc-200 placeholder:text-zinc-700 focus-visible:border-red-500/60 focus-visible:ring-red-500/10" placeholder="例：近距離戦でエイムが下がり、先にダウンします" />
              </label>

              {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] p-3 text-xs leading-5 text-red-300"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
              <Button type="button" onClick={() => void submit()} disabled={!canSubmit} className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-sm font-semibold shadow-[0_10px_35px_rgba(220,38,38,.2)] hover:from-red-500 hover:to-red-400 disabled:opacity-70">
                {status === "analyzing" ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {status === "analyzing" ? (file ? "フレームをスキャン中..." : "コーチングを生成中...") : "AIコーチに解析させる"}
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[9px] text-zinc-700"><Shield className="size-3 shrink-0" />{concern.trim().length < 8 ? "悩みを8文字以上入力すると解析できます。動画は任意です。" : "動画は任意です。アップロードした場合のみプレビューし、解析後は保存しません。"}</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              form=""
              onChange={onFileChange}
              className="sr-only"
              aria-label="ゲーム動画"
            />
          </Card>

          <Card className="min-h-[520px] overflow-hidden border-white/[0.08] bg-[#0e0e10]/95 p-0 text-white shadow-2xl shadow-black/40 sm:min-h-[620px]">
            {(status === "empty" || status === "ready" || status === "error") && (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-10 text-center sm:min-h-[620px] sm:px-8">
                <div className="relative"><div className="absolute -inset-7 rounded-full bg-red-500/10 blur-2xl" /><div className="relative grid size-16 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]"><Play className="ml-1 size-6 fill-red-500/20 text-red-400" /></div></div>
                <p className="mt-6 text-base font-semibold">{file ? "解析の準備ができました" : "動画なしでもコーチングできます"}</p>
                <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">{file ? "プレビューを確認し、AIコーチに解析させるを押してください。クリップに基づく指摘が出ます。" : "ゲーム・ランク・キャラ・悩みを入力して解析を開始。クリップを足すと、タイムスタンプ付きの具体指摘になります。"}</p>
                <div className="mt-7 grid w-full max-w-md grid-cols-2 gap-2 text-left sm:grid-cols-4">
                  {["Aim", "Sightlines", "Abilities", "Practice"].map((item, index) => <div key={item} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"><span className="text-[9px] text-red-400">0{index + 1}</span><p className="mt-1 text-[10px] text-zinc-500">{item}</p></div>)}
                </div>
              </div>
            )}

            {status === "analyzing" && (
              <div className="relative flex min-h-[520px] flex-col items-center justify-center overflow-hidden px-6 text-center sm:min-h-[620px] sm:px-8">
                <div className="absolute inset-x-0 top-[38%] h-px animate-pulse bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_18px_#ef4444]" />
                <div className="relative grid size-20 place-items-center rounded-3xl border border-red-500/20 bg-red-500/[0.07]"><ScanLine className="size-8 animate-pulse text-red-400" /><span className="absolute -inset-2 animate-ping rounded-[28px] border border-red-500/10" /></div>
                <p className="mt-7 text-lg font-semibold">{file ? "フレームをスキャン中" : "状況を分析中"}</p>
                <p className="mt-2 text-xs text-zinc-600">{file ? (progress < 35 ? "動画をデコードしています" : progress < 70 ? "戦闘シーンと視点移動を検出しています" : "改善ポイントをコーチングに変換しています") : (progress < 35 ? "ランクと悩みを読み込んでいます" : progress < 70 ? "キャラと戦型の典型パターンを照合しています" : "改善ポイントをコーチングに変換しています")}</p>
                <Progress value={progress} className="mt-7 h-1.5 max-w-sm bg-white/[0.05] [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-red-700 [&_[data-slot=progress-indicator]]:to-red-400" />
                <div className="mt-3 flex w-full max-w-sm justify-between font-mono text-[9px] text-zinc-700"><span>FRAME_SCAN</span><span>{Math.round(progress)}%</span></div>
              </div>
            )}

            {status === "complete" && result && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6">
                  <div><div className="flex items-center gap-2"><Check className="size-3.5 text-emerald-400" /><p className="text-sm font-semibold">{result.headline}</p></div><p className="mt-1 pl-5.5 font-mono text-[9px] text-zinc-700">ANALYSIS · {result.analysisId.slice(0, 8).toUpperCase()}</p></div>
                  <Badge className="border border-emerald-500/15 bg-emerald-500/10 text-[9px] text-emerald-400">{file ? "SCAN COMPLETE" : "NOTES PLAN"}</Badge>
                </div>
                <div className="p-5 sm:p-6">
                  <p className="text-sm leading-6 text-zinc-300"><Typewriter text={result.summary} /></p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {result.insights.map((insight, index) => <InsightCard key={insight.id} insight={insight} index={index} />)}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
        <footer className="mt-5 flex flex-col items-center justify-between gap-2 border-t border-white/[0.05] pt-5 text-[9px] uppercase tracking-[0.13em] text-zinc-800 sm:flex-row"><span>VODCoach.AI · Multigame intelligence</span><span>Built for the next round</span></footer>
      </div>
    </main>
  );
}

function InsightCard({ insight, index }: { insight: CoachInsight; index: number }) {
  const Icon = insightIcons[insight.id];
  return (
    <article className={`rounded-2xl border p-4 ${insight.id === "practice" ? "border-red-500/20 bg-gradient-to-br from-red-500/[0.09] to-transparent" : "border-white/[0.07] bg-white/[0.022]"}`}>
      <div className="flex items-start justify-between">
        <div className="grid size-8 place-items-center rounded-lg bg-red-500/10"><Icon className="size-4 text-red-400" /></div>
        <span className="font-mono text-[9px] text-zinc-700">{insight.timestamp ?? `0${index + 1}`}</span>
      </div>
      <h2 className="mt-3 text-xs font-semibold">{insight.title}</h2>
      <p className="mt-2 min-h-10 text-[10px] leading-4 text-zinc-600"><Typewriter text={insight.finding} delay={120 + index * 180} /></p>
      <div className="mt-3 border-t border-white/[0.05] pt-3"><p className="text-[9px] font-semibold uppercase tracking-wider text-red-400">Coach action</p><p className="mt-1 text-[10px] leading-4 text-zinc-400"><Typewriter text={insight.action} delay={320 + index * 180} /></p></div>
    </article>
  );
}
