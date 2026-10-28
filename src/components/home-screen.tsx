"use client";

import {
  ChangeEvent, DragEvent, MouseEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition,
} from "react";
import {
  AlertCircle, Check, ChevronDown, FileVideo, Gamepad2, LoaderCircle,
  Monitor, Play, ScanLine, Shield, Sparkles, UploadCloud, X,
} from "lucide-react";
import { signOutToHome } from "@/app/auth/sign-out-action";
import { FightExpanders } from "@/components/fight-expanders";
import { InsightBoard } from "@/components/insight-board";
import { LanguagePicker } from "@/components/language-picker";
import { LiveSession } from "@/components/live-session";
import { ProPlanControls } from "@/components/pro-plan-controls";
import { ShareTweetButton } from "@/components/share-tweet-button";
import { ViralScriptBlock } from "@/components/viral-script-block";
import {
  DEFAULT_COACH_LANGUAGE,
  insightTabLabel,
  readStoredLanguage,
  writeStoredLanguage,
  type CoachLanguage,
} from "@/lib/coach-language";
import { alignBundle, applyBundle, bundleFromResult, type CoachTextBundle } from "@/lib/coach/coach-text";
import { requestCoachTranslation } from "@/lib/coach/translate-client";
import {
  deleteSavedCoaching,
  getSavedCoaching,
  listSavedCoaching,
  putSavedCoaching,
  rememberTranslation,
  summaryOf,
  type SavedCoachingRecord,
  type SavedCoachingSummary,
} from "@/lib/saved-coaching";
import { concernFor, fillTemplate, knownConcerns, localizeKnownError, uiCopy, uploadHintFor } from "@/lib/ui-copy";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { MATCH_STALL_ERROR, MATCH_STALL_MS, isAnalysisStalled } from "@/lib/analysis-stall";
import { mapPool } from "@/lib/async-pool";
import { COACH_REQUEST_TIMEOUT_MS, isAbortError, requestCoach } from "@/lib/coach/client";
import type { CoachChunkReport, CoachFrame, CoachResponse } from "@/lib/coach/types";
import { extractJpegFramesInRange } from "@/lib/extract-frames";
import { gameConfigs, gameIds, type GameId } from "@/lib/games";
import {
  isLongMatch,
  MATCH_CHUNK_CONCURRENCY,
  MATCH_CHUNK_STAGGER_MS,
  MATCH_COVER_MAX_SEC,
  planMatchChunks,
  type MatchChunk,
} from "@/lib/match-plan";
import {
  COACH_FILE_ACCEPT,
  STATIC_FILE_INPUT_ATTR,
  clearFileInputValue,
  fileFromDataTransfer,
  installSafariValidityPatch,
  removeDocumentFileInputs,
  silenceNativeValidation,
} from "@/lib/pick-video-file";
import { probeVideoDuration } from "@/lib/probe-video";
import { MAX_CLIP_BYTES } from "@/lib/blob";
import { uploadClipToBlob } from "@/lib/upload-clip";
import { isAllowedCoachVideo } from "@/lib/video";

const MAX_BYTES = MAX_CLIP_BYTES;

function subscribeLanguage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("vodcoach-language", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("vodcoach-language", onStoreChange);
  };
}

function changeLanguage(next: CoachLanguage) {
  writeStoredLanguage(next);
  window.dispatchEvent(new Event("vodcoach-language"));
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

type AppMode = "vod" | "live";
type VodStatus = "empty" | "ready" | "analyzing" | "complete" | "error";
type ProgressPhase = "prepare-video" | "prepare-notes" | "duration" | "upload" | "clip" | "parallel" | "chunk-done" | "retry" | "merge" | null;

function nowMs() {
  return Date.now();
}

export default function HomeScreen({ signedIn }: { signedIn: boolean }) {
  const [signingOut, startSignOut] = useTransition();
  const [appMode, setAppMode] = useState<AppMode>("vod");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [game, setGame] = useState<GameId>("apex-legends");
  const [rank, setRank] = useState(gameConfigs["apex-legends"].defaultRank);
  const [character, setCharacter] = useState(gameConfigs["apex-legends"].defaultCharacter);
  const [concern, setConcern] = useState(gameConfigs["apex-legends"].defaultConcern);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<VodStatus>("empty");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<ProgressPhase>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CoachResponse | null>(null);
  const [sourceResult, setSourceResult] = useState<CoachResponse | null>(null);
  const [translations, setTranslations] = useState<Partial<Record<CoachLanguage, CoachTextBundle>>>({});
  const [sourceLanguage, setSourceLanguage] = useState<CoachLanguage>(DEFAULT_COACH_LANGUAGE);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [saved, setSaved] = useState<SavedCoachingSummary[]>([]);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState("");
  const [analysisFrames, setAnalysisFrames] = useState<CoachFrame[]>([]);
  const language = useSyncExternalStore(subscribeLanguage, readStoredLanguage, () => DEFAULT_COACH_LANGUAGE);
  const t = uiCopy(language);
  const urlRef = useRef("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);
  const lastProgressAtRef = useRef(0);
  const languageRef = useRef(language);
  const translateSeq = useRef(0);
  const framesRef = useRef<CoachFrame[]>([]);
  const uploadedUrlRef = useRef("");
  const fileRef = useRef<File | null>(null);
  languageRef.current = language;
  fileRef.current = file;
  const gameConfig = gameConfigs[game];
  const shown = useMemo(() => {
    if (!sourceResult) return result;
    const cached = translations[language];
    if (cached) return applyBundle(sourceResult, cached);
    return result;
  }, [language, result, sourceResult, translations]);
  const hasNotes = concern.trim().length >= 8;
  const canSubmit = status !== "analyzing" && (Boolean(file) || hasNotes);
  const watchingStall = status === "analyzing" && chunkProgress != null;

  useEffect(() => {
    removeDocumentFileInputs();
    const undoValidityPatch = installSafariValidityPatch();
    const blockNative = (event: Event) => {
      silenceNativeValidation(event);
    };
    window.addEventListener("submit", blockNative, true);
    window.addEventListener("invalid", blockNative, true);
    document.addEventListener("submit", blockNative, true);
    document.addEventListener("invalid", blockNative, true);
    return () => {
      cancelledRef.current = true;
      runIdRef.current += 1;
      abortRef.current?.abort();
      window.removeEventListener("submit", blockNative, true);
      window.removeEventListener("invalid", blockNative, true);
      document.removeEventListener("submit", blockNative, true);
      document.removeEventListener("invalid", blockNative, true);
      undoValidityPatch();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!watchingStall) return;
    const timer = window.setInterval(() => {
      if (cancelledRef.current) return;
      if (!isAnalysisStalled(lastProgressAtRef.current, nowMs(), MATCH_STALL_MS)) return;
      runIdRef.current += 1;
      abortRef.current?.abort(new Error(MATCH_STALL_ERROR));
      setChunkProgress(null);
      setError(MATCH_STALL_ERROR);
      setStatus("error");
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [watchingStall]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.docTitle;
    setConcern((current) => (knownConcerns(game).includes(current) ? concernFor(language, game) : current));
  }, [game, language, t.docTitle]);

  useEffect(() => {
    void listSavedCoaching().then(setSaved).catch(() => setSaved([]));
  }, []);

  useEffect(() => {
    if (!sourceResult || !activeId) {
      setTranslating(false);
      return;
    }
    if (translations[language]) {
      setTranslating(false);
      return;
    }
    const seq = translateSeq.current + 1;
    translateSeq.current = seq;
    const controller = new AbortController();
    setTranslating(true);
    void requestCoachTranslation(
      {
        language,
        sourceLanguage,
        bundle: bundleFromResult(sourceResult),
      },
      controller.signal,
    )
      .then(async (bundle) => {
        if (seq !== translateSeq.current) return;
        const aligned = alignBundle(bundleFromResult(sourceResult), bundle);
        setTranslations((current) => ({ ...current, [language]: aligned }));
        setResult(applyBundle(sourceResult, aligned));
        setTranslating(false);
        await rememberTranslation(activeId, language, aligned).catch(() => undefined);
        setSaved((list) =>
          list.map((item) =>
            item.id === activeId
              ? { ...item, headlines: { ...item.headlines, [language]: aligned.headline } }
              : item,
          ),
        );
      })
      .catch((reason) => {
        if (seq !== translateSeq.current || controller.signal.aborted || isAbortError(reason)) return;
        setTranslating(false);
      });
    return () => controller.abort();
  }, [activeId, language, sourceLanguage, sourceResult]);

  function acceptVideo(nextFile: File) {
    setError("");
    if (!isAllowedCoachVideo(nextFile)) {
      setError(uiCopy(languageRef.current).fileTypeError);
      setStatus("error");
      return;
    }
    if (nextFile.size > MAX_BYTES) {
      setError(uiCopy(languageRef.current).fileSizeError);
      setStatus("error");
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const nextUrl = URL.createObjectURL(nextFile);
    urlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    setFile(nextFile);
    setUploadedVideoUrl("");
    framesRef.current = [];
    setAnalysisFrames([]);
    setResult(null);
    setSourceResult(null);
    setActiveId(null);
    setTranslations({});
    setStatus("ready");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.currentTarget.files?.item(0) ?? null;
    clearFileInputValue(event.currentTarget);
    if (nextFile) acceptVideo(nextFile);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    removeDocumentFileInputs();
    const nextFile = fileFromDataTransfer(event.dataTransfer);
    if (nextFile) acceptVideo(nextFile);
  }

  function clearVideo() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
    setPreviewUrl("");
    setFile(null);
    setUploadedVideoUrl("");
    framesRef.current = [];
    uploadedUrlRef.current = "";
    setAnalysisFrames([]);
    setResult(null);
    setSourceResult(null);
    setActiveId(null);
    setTranslations({});
    setError("");
    setStatus("empty");
  }

  function changeGame(nextGame: string) {
    const gameId = nextGame as GameId;
    const nextConfig = gameConfigs[gameId];
    setGame(gameId);
    setRank(nextConfig.defaultRank);
    setCharacter(nextConfig.defaultCharacter);
    setConcern(concernFor(languageRef.current, gameId));
    setResult(null);
    setSourceResult(null);
    setActiveId(null);
    setTranslations({});
    setError("");
    setStatus(file ? "ready" : "empty");
  }

  function onAnalyzePointerDown() {
    silenceNativeValidation();
  }

  function onAnalyzeClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    silenceNativeValidation();
    void submit();
  }

  async function submit() {
    silenceNativeValidation();
    if (!file && concern.trim().length < 8) {
      setError(uiCopy(languageRef.current).needInput);
      setStatus("error");
      return;
    }
    abortRef.current?.abort();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const run = new AbortController();
    abortRef.current = run;
    const touchProgress = () => {
      lastProgressAtRef.current = nowMs();
    };
    touchProgress();

    setError("");
    setResult(null);
    setAnalysisFrames([]);
    if (!file) setUploadedVideoUrl("");
    setChunkProgress(null);
    setUploadPercent(null);
    setProgress(4);
    setPhase(file ? "prepare-video" : "prepare-notes");
    setStatus("analyzing");
    const startFakeProgress = () =>
      window.setInterval(() => {
        setProgress((current) => Math.min(current + Math.max(0.6, (88 - current) * 0.03), 88));
      }, 240);
    let timer = startFakeProgress();

    const coach = (body: Parameters<typeof requestCoach>[0], timeoutMs?: number) =>
      requestCoach(body, { signal: run.signal, timeoutMs });

    try {
      const trimmedConcern = concern.trim();
      const base = { game, rank, character, concern: trimmedConcern, language };
      if (!file) {
        const payload = await coach({ ...base, mode: "clip" });
        finishSuccess(runId, payload);
        return;
      }

      setPhase("duration");
      const duration = await probeVideoDuration(file);
      if (run.signal.aborted) throw new Error(MATCH_STALL_ERROR);
      touchProgress();
      const match = isLongMatch(duration);
      window.clearInterval(timer);
      setUploadPercent(0);
      setProgress(0);
      setPhase("upload");
      const videoUrl = await uploadClipToBlob(file, {
        signal: run.signal,
        onProgress: ({ percentage }) => {
          touchProgress();
          const pct = Math.max(0, Math.min(100, Math.round(percentage)));
          setUploadPercent(pct);
          setProgress(pct);
          setPhase("upload");
        },
      });
      uploadedUrlRef.current = videoUrl;
      setUploadedVideoUrl(videoUrl);
      setUploadPercent(null);
      setProgress((current) => Math.max(current, 12));
      timer = startFakeProgress();
      touchProgress();

      if (!match || duration == null) {
        setPhase("clip");
        const payload = await coach({ ...base, videoUrl, mode: "clip", durationSec: duration ?? undefined });
        finishSuccess(runId, payload);
        return;
      }

      const chunks = planMatchChunks(duration);
      const truncated = duration > MATCH_COVER_MAX_SEC;
      const reports: Array<CoachChunkReport | null> = Array.from({ length: chunks.length }, () => null);
      let finished = 0;

      const analyzeChunk = async (chunk: MatchChunk, frames: CoachFrame[]) => {
        const knownPoi = reports.find((report) => report?.mapPoi)?.mapPoi;
        const payload = await coach({
          ...base,
          videoUrl,
          frames,
          mode: "match-chunk",
          startOffsetSec: chunk.startSec,
          endOffsetSec: chunk.endSec,
          durationSec: duration,
          chunkIndex: chunk.index,
          chunkCount: chunks.length,
          mapPoi: knownPoi,
        });
        return {
          headline: payload.headline,
          summary: payload.summary,
          insights: payload.insights,
          closeRangeFights: payload.closeRangeFights,
          rotation: payload.rotation,
          startOffsetSec: chunk.startSec,
          endOffsetSec: chunk.endSec,
          mapPoi: payload.mapPoi,
        } satisfies CoachChunkReport;
      };

      const markChunkProgress = () => {
        finished += 1;
        touchProgress();
        setChunkProgress({ done: finished, total: chunks.length });
        setProgress(8 + Math.round((finished / Math.max(1, chunks.length)) * 70));
        setPhase("chunk-done");
      };

      touchProgress();
      setChunkProgress({ done: 0, total: chunks.length });
      setPhase("parallel");
      try {
        await mapPool(
          chunks,
          MATCH_CHUNK_CONCURRENCY,
          async (chunk) => {
            try {
              reports[chunk.index] = await analyzeChunk(chunk, []);
            } catch (reason) {
              if (run.signal.aborted || isAbortError(reason)) throw reason;
              // Blob URL / 500 / 504 / per-request timeout — JPEG backup below, one at a time.
            } finally {
              markChunkProgress();
            }
          },
          { staggerMs: MATCH_CHUNK_STAGGER_MS, signal: run.signal },
        );
      } catch (reason) {
        if (!run.signal.aborted && !isAbortError(reason)) throw reason;
      }

      const missing = chunks.filter((chunk) => !reports[chunk.index]);
      if (missing.length > 0 && !run.signal.aborted) {
        touchProgress();
        setRetryCount(missing.length);
        setPhase("retry");
        for (const chunk of missing) {
          if (run.signal.aborted) break;
          try {
            const frames = await extractJpegFramesInRange(
              videoRef.current,
              previewUrl,
              chunk.startSec,
              chunk.endSec,
              6,
            );
            touchProgress();
            reports[chunk.index] = await analyzeChunk(chunk, frames);
            setAnalysisFrames((current) => {
              const next = [...current, ...frames];
              framesRef.current = next;
              return next;
            });
            touchProgress();
          } catch (reason) {
            if (run.signal.aborted || isAbortError(reason)) break;
            touchProgress();
          }
        }
      }

      const collected = reports.filter((report): report is CoachChunkReport => report != null);
      const failed = chunks.length - collected.length;
      if (run.signal.aborted) {
        throw new Error(MATCH_STALL_ERROR);
      }
      if (collected.length === 0) {
        throw new Error(uiCopy(languageRef.current).matchFailed);
      }

      touchProgress();
      setPhase("merge");
      setProgress(92);
      const merged = await requestCoach(
        {
          ...base,
          mode: "match-merge",
          durationSec: duration,
          chunkReports: collected,
        },
        { signal: run.signal, timeoutMs: COACH_REQUEST_TIMEOUT_MS },
      );
      touchProgress();
      if (truncated) {
        merged.truncated = true;
        merged.summary = `${merged.summary} ${fillTemplate(uiCopy(languageRef.current).truncated, { n: Math.round(MATCH_COVER_MAX_SEC / 60) })}`;
      }
      if (failed > 0) {
        merged.summary = `${merged.summary} ${fillTemplate(uiCopy(languageRef.current).skipped, { n: failed })}`;
      }
      finishSuccess(runId, merged);
    } catch (reason) {
      if (cancelledRef.current || runIdRef.current !== runId) return;
      failAnalyze(reason instanceof Error ? reason.message : uiCopy(languageRef.current).analyzeFailed);
    } finally {
      window.clearInterval(timer);
    }
  }

  function failAnalyze(message: string) {
    if (cancelledRef.current) return;
    runIdRef.current += 1;
    abortRef.current?.abort();
    setChunkProgress(null);
    setUploadPercent(null);
    setError(message);
    setStatus("error");
  }

  function finishSuccess(runId: number, payload: CoachResponse) {
    if (cancelledRef.current || runIdRef.current !== runId) return;
    const lang = languageRef.current;
    const bundle = bundleFromResult(payload);
    const record: SavedCoachingRecord = {
      id: payload.analysisId,
      savedAt: Date.now(),
      updatedAt: Date.now(),
      game,
      character,
      rank,
      concern: concern.trim(),
      sourceLanguage: lang,
      result: payload,
      translations: { [lang]: bundle },
      videoName: fileRef.current?.name,
      remoteVideoUrl: uploadedUrlRef.current || undefined,
    };
    setChunkProgress(null);
    setUploadPercent(null);
    setPhase(null);
    setProgress(100);
    setSourceLanguage(lang);
    setSourceResult(payload);
    setTranslations({ [lang]: bundle });
    setActiveId(payload.analysisId);
    setResult(payload);
    setSaved((list) => [summaryOf(record), ...list.filter((item) => item.id !== record.id)]);
    void putSavedCoaching(record, {
      id: record.id,
      videoBlob: fileRef.current ?? undefined,
      frames: framesRef.current,
    }).catch(() => undefined);
    window.setTimeout(() => {
      if (!cancelledRef.current && runIdRef.current === runId) setStatus("complete");
    }, 260);
  }

  async function openSaved(id: string) {
    const loaded = await getSavedCoaching(id);
    if (!loaded) return;
    const { record, media } = loaded;
    setAppMode("vod");
    setGame(record.game);
    setRank(record.rank);
    setCharacter(record.character);
    setConcern(record.concern);
    setSourceLanguage(record.sourceLanguage);
    setSourceResult(record.result);
    setTranslations(record.translations);
    setActiveId(record.id);
    const cached = record.translations[languageRef.current] ?? record.translations[record.sourceLanguage];
    setResult(cached ? applyBundle(record.result, cached) : record.result);
    setError("");
    setPhase(null);
    setStatus("complete");
    uploadedUrlRef.current = record.remoteVideoUrl || "";
    setUploadedVideoUrl(record.remoteVideoUrl || "");
    framesRef.current = media?.frames ?? [];
    setAnalysisFrames(media?.frames ?? []);
    if (media?.videoBlob) {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(media.videoBlob);
      urlRef.current = url;
      setPreviewUrl(url);
      const nextFile = new File([media.videoBlob], record.videoName || "clip.mp4", {
        type: media.videoBlob.type || "video/mp4",
      });
      fileRef.current = nextFile;
      setFile(nextFile);
    }
  }

  async function removeSaved(id: string) {
    await deleteSavedCoaching(id).catch(() => undefined);
    setSaved((list) => list.filter((item) => item.id !== id));
    if (activeId !== id) return;
    setSourceResult(null);
    setResult(null);
    setTranslations({});
    setActiveId(null);
    setTranslating(false);
    setStatus(fileRef.current ? "ready" : "empty");
  }

  function progressText() {
    const done = chunkProgress?.done ?? 0;
    const total = chunkProgress?.total ?? 0;
    if (phase === "prepare-video") return t.preparingVideo;
    if (phase === "prepare-notes") return t.preparingNotes;
    if (phase === "duration") return t.checkingDuration;
    if (phase === "upload") return fillTemplate(t.uploadProgress, { n: Math.round(uploadPercent ?? 0) });
    if (phase === "clip") return t.analyzingClip;
    if (phase === "parallel") return fillTemplate(t.chunkParallel, { total });
    if (phase === "chunk-done") return fillTemplate(t.chunkDone, { done, total });
    if (phase === "retry") return fillTemplate(t.chunkRetry, { n: retryCount });
    if (phase === "merge") return t.merging;
    return "";
  }

  const reportKind = shown?.kind ?? (file ? "clip" : "notes");
  const insightInstant = Boolean(shown && shown.insights.length > 6);
  const progressLabel = progressText();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070708] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.18),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative mx-auto max-w-[1480px] px-4 pb-10 sm:px-6 lg:px-10">
        <header className="flex min-h-18 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/[0.06] py-2">
          <div className="flex items-center gap-3">
            <div className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-red-500 to-red-800 shadow-[0_0_28px_rgba(239,68,68,.3)]">
              <span className="absolute -right-1 -top-2 text-2xl font-black italic text-white/15">A</span>
              <Gamepad2 className="relative size-5" />
            </div>
            <div>
              <p className="text-[15px] font-bold tracking-[-0.03em]">VODCoach<span className="text-red-500">.AI</span></p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">{t.brandTagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <ProPlanControls language={language} />
            {signedIn ? (
              <button
                type="button"
                onClick={() => startSignOut(() => void signOutToHome())}
                disabled={signingOut}
                className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-zinc-300 hover:text-white disabled:opacity-60"
              >
                {t.signOut}
              </button>
            ) : null}
            <LanguagePicker language={language} label={t.languageLabel} onChange={changeLanguage} />
            <Badge className="border border-red-500/15 bg-red-500/10 text-[10px] text-red-300">
              <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-red-400" />{t.analyzerOnline}
            </Badge>
            <span className="hidden text-[10px] text-zinc-700 sm:inline">Apex · VALORANT</span>
          </div>
        </header>

        <section className="pb-7 pt-9 sm:pt-12">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">
            <ScanLine className="size-3.5" />{t.eyebrow}
          </div>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.05em] sm:text-5xl lg:text-[58px]">
            {t.heroLead}<span className="inline-block bg-gradient-to-r from-red-300 via-red-500 to-orange-400 bg-clip-text text-transparent">{t.heroAccent}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500">
            {t.heroBody}
          </p>
          <div className="mt-6 inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setAppMode("vod")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${appMode === "vod" ? "bg-red-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              <ScanLine className="size-3.5" />{t.modeVod}
            </button>
            <button
              type="button"
              onClick={() => setAppMode("live")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${appMode === "live" ? "bg-red-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              <Monitor className="size-3.5" />{t.modeLive}
            </button>
          </div>
        </section>

        {appMode === "live" && (
          <>
            <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1.4fr]">
              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">{t.game}</span>
                <div className="relative">
                  <select value={game} onChange={(event) => changeGame(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 pr-10 text-sm text-zinc-200 outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10" aria-label={t.game}>
                    {gameIds.map((gameId) => <option key={gameId} value={gameId}>{gameConfigs[gameId].name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-zinc-600" />
                </div>
              </label>
              <SelectField label={t.rank} value={rank} options={gameConfig.ranks} onChange={setRank} />
              <SelectField label={game === "valorant" ? t.agent : t.legend} value={character} options={gameConfig.characters} onChange={setCharacter} />
              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">{t.focus}</span>
                <Textarea value={concern} onChange={(event) => setConcern(event.target.value.slice(0, 240))} className="min-h-11 resize-none border-white/[0.08] bg-white/[0.035] px-3.5 py-2.5 text-sm leading-5 text-zinc-200 placeholder:text-zinc-700 focus-visible:border-red-500/60 focus-visible:ring-red-500/10" placeholder={t.focusPlaceholder} />
              </label>
            </div>
            <LiveSession game={game} rank={rank} character={character} concern={concern} language={language} />
          </>
        )}

        {appMode === "vod" && (
        <div className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
          <section className="xl:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">{t.savedHeading}</p>
            {saved.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-600">{t.savedEmpty}</p>
            ) : (
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {saved.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <button type="button" onClick={() => void openSaved(item.id)} className="min-w-0 flex-1 truncate text-left text-sm text-zinc-200 hover:text-white">
                      {item.headlines[language] || item.headlines[item.sourceLanguage] || item.character}
                    </button>
                    <button type="button" onClick={() => void openSaved(item.id)} className="text-[11px] font-semibold text-zinc-400 hover:text-white">{t.savedOpen}</button>
                    <button type="button" onClick={() => void removeSaved(item.id)} className="text-[11px] font-semibold text-red-300 hover:text-red-200" aria-label={t.savedDelete}>{t.savedDelete}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Card className="border-white/[0.08] bg-[#0e0e10]/95 p-0 text-white shadow-2xl shadow-black/40">
            <div className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{t.vodTitle} <span className="font-normal text-zinc-500">{t.optional}</span></p>
                  <p className="mt-1 text-[11px] text-zinc-600">{t.fileFormats}</p>
                </div>
                {file && <button type="button" onClick={clearVideo} className="grid size-8 place-items-center rounded-lg text-zinc-600 transition hover:bg-white/5 hover:text-white" aria-label={t.removeVideo}><X className="size-4" /></button>}
              </div>

              {!previewUrl ? (
                <div
                  data-testid="clip-dropzone"
                  onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                    setDragging(false);
                  }}
                  onDrop={onDrop}
                  className={`group relative flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed p-5 text-center transition focus-within:border-red-500/60 sm:min-h-52 ${dragging ? "border-red-400 bg-red-500/10" : "border-white/10 bg-black/20 hover:border-red-500/40 hover:bg-red-500/[0.035]"}`}
                >
                  <input
                    type="file"
                    accept={COACH_FILE_ACCEPT}
                    {...{ [STATIC_FILE_INPUT_ATTR]: "static" }}
                    data-testid="clip-file-input"
                    aria-label={t.pickVideo}
                    onChange={onFileChange}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                  <div className="pointer-events-none flex flex-col items-center">
                    <div className="grid size-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-lg shadow-black/30"><UploadCloud className="size-5 text-red-400 transition group-hover:-translate-y-0.5" /></div>
                    <p className="mt-4 text-sm font-medium">{t.dropTitle}</p>
                    <p className="mt-1.5 text-[11px] text-zinc-600">{uploadHintFor(language, game)}。{t.dropAlso}</p>
                    <span className="mt-4 inline-flex h-7 items-center rounded-lg bg-white px-2.5 text-[0.8rem] font-medium text-black">{t.chooseFile}</span>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
                  <div className="relative aspect-video">
                    <video ref={videoRef} src={previewUrl} controls playsInline className="size-full object-contain" aria-label={t.previewAria} />
                    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[9px] uppercase tracking-wider text-red-300 backdrop-blur"><span className="size-1.5 rounded-full bg-red-500" />{t.previewReady}</div>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2 text-[10px] text-zinc-500"><FileVideo className="size-3.5 shrink-0 text-red-400" /><span className="truncate">{file?.name}</span></span>
                    <span className="ml-3 shrink-0 text-[10px] text-zinc-700">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ""}</span>
                  </div>
                </div>
              )}
              <label className="mt-5 block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">{t.game}</span>
                <div className="relative">
                  <select value={game} onChange={(event) => changeGame(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 pr-10 text-sm text-zinc-200 outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10" aria-label={t.game}>
                    {gameIds.map((gameId) => <option key={gameId} value={gameId}>{gameConfigs[gameId].name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-zinc-600" />
                </div>
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <SelectField label={t.rank} value={rank} options={gameConfig.ranks} onChange={setRank} />
                <SelectField label={game === "valorant" ? t.agent : t.legend} value={character} options={gameConfig.characters} onChange={setCharacter} />
              </div>
              <label className="mt-4 block space-y-2">
                <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">{t.struggle} <span className="font-normal normal-case tracking-normal text-zinc-700">{concern.length}/240</span></span>
                <Textarea value={concern} onChange={(event) => setConcern(event.target.value.slice(0, 240))} className="min-h-24 resize-none border-white/[0.08] bg-white/[0.035] text-sm leading-5 text-zinc-200 placeholder:text-zinc-700 focus-visible:border-red-500/60 focus-visible:ring-red-500/10" placeholder={t.strugglePlaceholder} />
              </label>

              {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] p-3 text-xs leading-5 text-red-300"><AlertCircle className="mt-0.5 size-4 shrink-0" />{localizeKnownError(error, language)}</div>}
              <button
                type="button"
                formNoValidate
                data-testid="coach-submit"
                onPointerDown={onAnalyzePointerDown}
                onClick={onAnalyzeClick}
                disabled={!canSubmit}
                className="mt-5 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-sm font-semibold text-white shadow-[0_10px_35px_rgba(220,38,38,.2)] hover:from-red-500 hover:to-red-400 disabled:pointer-events-none disabled:opacity-70"
              >
                {status === "analyzing" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {status === "analyzing" ? (chunkProgress ? fillTemplate(t.chunkButton, { done: chunkProgress.done, total: chunkProgress.total }) : uploadPercent != null ? fillTemplate(t.uploadProgress, { n: Math.round(uploadPercent) }) : file ? t.analyzingMatch : t.analyzingNotes) : t.analyze}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[9px] text-zinc-700"><Shield className="size-3 shrink-0" />{file || hasNotes ? t.privacyWithFile : t.privacyEmpty}</p>
            </div>
          </Card>

          <Card className="min-h-[520px] overflow-hidden border-white/[0.08] bg-[#0e0e10]/95 p-0 text-white shadow-2xl shadow-black/40 sm:min-h-[620px]">
            {(status === "empty" || status === "ready" || status === "error") && (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-10 text-center sm:min-h-[620px] sm:px-8">
                <div className="relative"><div className="absolute -inset-7 rounded-full bg-red-500/10 blur-2xl" /><div className="relative grid size-16 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]"><Play className="ml-1 size-6 fill-red-500/20 text-red-400" /></div></div>
                <p className="mt-6 text-base font-semibold">{file ? t.readyTitle : t.emptyTitle}</p>
                <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">{file ? t.readyBody : t.emptyBody}</p>
                <div className="mt-7 grid w-full max-w-md grid-cols-2 gap-2 text-left sm:grid-cols-3 lg:grid-cols-5">
                  {(["rotation", "aim", "abilities", "endgame", "other"] as const).map((item, index) => <div key={item} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"><span className="text-[9px] text-red-400">0{index + 1}</span><p className="mt-1 text-[10px] text-zinc-500">{insightTabLabel(item, language)}</p></div>)}
                </div>
              </div>
            )}

            {status === "analyzing" && (
              <div className="relative flex min-h-[520px] flex-col items-center justify-center overflow-hidden px-6 text-center sm:min-h-[620px] sm:px-8">
                <div className="absolute inset-x-0 top-[38%] h-px animate-pulse bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_18px_#ef4444]" />
                <div className="relative grid size-20 place-items-center rounded-3xl border border-red-500/20 bg-red-500/[0.07]"><ScanLine className="size-8 animate-pulse text-red-400" /><span className="absolute -inset-2 animate-ping rounded-[28px] border border-red-500/10" /></div>
                <p className="mt-7 text-lg font-semibold">
                  {chunkProgress
                    ? fillTemplate(t.matchProgress, {
                        done: chunkProgress.done,
                        total: chunkProgress.total,
                        pct: Math.round((chunkProgress.done / Math.max(1, chunkProgress.total)) * 100),
                      })
                    : uploadPercent != null
                      ? fillTemplate(t.uploadProgress, { n: Math.round(uploadPercent) })
                      : file ? t.analyzingMatch : t.analyzingStatusNotes}
                </p>
                <p className="mt-2 text-xs text-zinc-600">{progressLabel || (file ? t.readingVideo : t.readingNotes)}</p>
                <Progress value={progress} className="mt-7 h-1.5 max-w-sm bg-white/[0.05] [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-red-700 [&_[data-slot=progress-indicator]]:to-red-400" />
                <div className="mt-3 flex w-full max-w-sm justify-between font-mono text-[9px] text-zinc-700">
                  <span>{chunkProgress ? `${t.metaChunk} ${chunkProgress.done}/${chunkProgress.total}` : uploadPercent != null ? t.metaUpload : file ? t.metaMatch : t.metaNotes}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>
            )}

            {status === "complete" && shown && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6">
                  <div><div className="flex items-center gap-2"><Check className="size-3.5 text-emerald-400" /><p className="text-sm font-semibold">{shown.headline}</p></div><p className="mt-1 pl-5.5 font-mono text-[9px] text-zinc-700">ANALYSIS · {shown.analysisId.slice(0, 8).toUpperCase()}</p></div>
                  <Badge className="border border-emerald-500/15 bg-emerald-500/10 text-[9px] text-emerald-400">
                    {reportKind === "match" ? t.badgeMatch : reportKind === "clip" ? t.badgeClip : t.badgeNotes}
                  </Badge>
                </div>
                <div className="p-5 sm:p-6">
                  {translating ? <p className="mb-3 text-[11px] text-zinc-500">{t.translating}</p> : null}
                  <p className="text-sm leading-6 text-zinc-300">{shown.summary}</p>
                  {shown.rotationStory ? (
                    <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.022] p-4">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-red-400">
                        {t.matchRotation}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">{shown.rotationStory}</p>
                    </div>
                  ) : null}
                  {shown.insights.length === 0 ? (
                    <p className="mt-6 text-sm leading-6 text-zinc-500">
                      {t.noInsights}
                    </p>
                  ) : (
                    <InsightBoard
                      key={shown.analysisId}
                      insights={shown.insights}
                      instant={insightInstant || translating}
                      language={language}
                    />
                  )}
                  <FightExpanders
                    fights={shown.closeRangeFights ?? []}
                    language={language}
                    previewUrl={previewUrl}
                    videoUrl={uploadedVideoUrl}
                    frames={analysisFrames}
                  />
                  {shown.viralScript ? (
                    <ViralScriptBlock script={shown.viralScript} language={language} />
                  ) : null}
                  <div className="mt-6 flex justify-end border-t border-white/[0.06] pt-5">
                    <ShareTweetButton result={shown} language={language} />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
        )}
        <footer className="mt-5 flex flex-col items-center justify-between gap-2 border-t border-white/[0.05] pt-5 text-[9px] uppercase tracking-[0.13em] text-zinc-800 sm:flex-row"><span>VODCoach.AI · Apex · VALORANT</span><span>{t.footerRight}</span></footer>
      </div>
    </main>
  );
}
