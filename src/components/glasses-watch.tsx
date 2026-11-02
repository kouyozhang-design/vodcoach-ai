"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Watch } from "lucide-react";
import type { CoachLanguage } from "@/lib/coach-language";
import { fetchGlassesSession, glassesRequest, GLASSES_CODE_KEY } from "@/lib/glasses-client";
import { glassesCopy } from "@/lib/glasses-copy";
import { glassesPluginUrl, normalizePairCode, type GlassesView, type WatchGesture } from "@/lib/glasses-session";

const CODE_EVENT = "vodcoach-glasses-code";

function browserOrigin() {
  return window.location.origin;
}

function subscribeCode(onStoreChange: () => void) {
  window.addEventListener(CODE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CODE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readStoredCode() {
  return normalizePairCode(window.localStorage.getItem(GLASSES_CODE_KEY)) ?? "";
}

function writeStoredCode(next: string) {
  if (next) window.localStorage.setItem(GLASSES_CODE_KEY, next);
  else window.localStorage.removeItem(GLASSES_CODE_KEY);
  window.dispatchEvent(new Event(CODE_EVENT));
}

export function GlassesWatch({ language }: { language: CoachLanguage }) {
  const copy = glassesCopy(language);
  const origin = useSyncExternalStore(() => () => undefined, browserOrigin, () => "");
  const code = useSyncExternalStore(subscribeCode, readStoredCode, () => "");
  const [view, setView] = useState<GlassesView | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const pluginUrl = code && origin ? glassesPluginUrl(origin, code) : "";

  function acceptView(next: GlassesView) {
    setView((current) => {
      if (current && current.code === next.code && next.revision < current.revision) return current;
      return next;
    });
  }

  useEffect(() => {
    if (!code) return;
    let stop = false;
    const tick = () => {
      void fetchGlassesSession(code)
        .then((next) => {
          if (stop) return;
          if (!next) {
            writeStoredCode("");
            setView(null);
            return;
          }
          acceptView(next);
        })
        .catch(() => {
          if (!stop) setError(copy.failed);
        });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [code, copy.failed]);

  useEffect(() => {
    if (!code) return;
    let stop = false;
    void glassesRequest({ action: "language", code, language })
      .then((next) => {
        if (!stop) acceptView(next);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [code, language]);

  async function open() {
    setError("");
    try {
      const next = await glassesRequest({ action: "open", language });
      writeStoredCode(next.code);
      acceptView(next);
    } catch {
      setError(copy.failed);
    }
  }

  function close() {
    writeStoredCode("");
    setView(null);
    setError("");
  }

  async function send(gesture: WatchGesture) {
    if (!code) return;
    try {
      acceptView(await glassesRequest({ action: "gesture", code, gesture, source: "watch" }));
      setError("");
    } catch {
      setError(copy.failed);
    }
  }

  async function sendLine(raw = draft) {
    const line = raw.trim();
    if (!code || !line) return;
    try {
      acceptView(await glassesRequest({ action: "line", code, line }));
      setDraft("");
      setError("");
    } catch {
      setError(copy.failed);
    }
  }

  async function copyUrl() {
    if (!pluginUrl) return;
    try {
      await navigator.clipboard.writeText(pluginUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const watchFace = [
    [copy.tap, "click", "glasses-tap"],
    [copy.double, "double-click", "glasses-double"],
    [copy.crownUp, "scroll-up", "glasses-crown-up"],
    [copy.crownDown, "scroll-down", "glasses-crown-down"],
    [copy.hold, "long-press", "glasses-hold"],
    [copy.brighter, "brighter", "glasses-brighter"],
    [copy.dimmer, "dimmer", "glasses-dimmer"],
  ] as const;

  return (
    <section
      data-testid="glasses-watch"
      className="mt-4 rounded-2xl border border-white/[0.08] bg-[#0e0e10]/95 p-4 text-white shadow-2xl shadow-black/40 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <Watch className="size-4 text-red-300" />
        </div>
        <div>
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-zinc-500">{copy.lead}</p>
        </div>
      </div>

      {!code ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            data-testid="glasses-open"
            onClick={() => void open()}
            className="h-11 rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-4 text-sm font-semibold text-white hover:from-red-500 hover:to-red-400"
          >
            {copy.open}
          </button>
          <p className="text-xs leading-5 text-zinc-500">{copy.waiting}</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-zinc-700 bg-black p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{copy.watch}</p>
                <p data-testid="glasses-code" className="mt-1 font-mono text-3xl tracking-[0.28em] text-white">
                  {code}
                </p>
              </div>
              <button type="button" onClick={close} className="text-[11px] text-zinc-500 hover:text-white">
                {copy.close}
              </button>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-zinc-600">
              {view?.mode === "cue" ? copy.cue : copy.standby}
              {view?.pinned ? ` · ${copy.pinned}` : ""}
              {view ? ` · ${view.index + (view.count > 0 && view.mode === "cue" ? 1 : 0)}/${view.count}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded-full border border-white/10 px-2 py-1 text-zinc-400">
                {copy.watch} {view?.watchConnected ? copy.on : copy.off}
              </span>
              <span data-testid="glasses-link" className="rounded-full border border-white/10 px-2 py-1 text-zinc-400">
                {copy.glasses} {view?.glassesConnected ? copy.on : copy.off}
              </span>
            </div>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const field = event.currentTarget.elements.namedItem("line");
                void sendLine(field instanceof HTMLInputElement ? field.value : draft);
              }}
            >
              <input
                name="line"
                value={draft}
                data-testid="glasses-line"
                onChange={(event) => setDraft(event.target.value.slice(0, 96))}
                placeholder={copy.linePlaceholder}
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-red-500/60"
              />
              <button
                type="button"
                data-testid="glasses-send"
                onClick={(event) => {
                  const field = event.currentTarget.form?.elements.namedItem("line");
                  void sendLine(field instanceof HTMLInputElement ? field.value : draft);
                }}
                className="h-10 shrink-0 rounded-xl bg-white px-3 text-[11px] font-semibold text-black"
              >
                {copy.sendLine}
              </button>
            </form>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {watchFace.map(([label, gesture, testId]) => (
                <button
                  key={gesture}
                  type="button"
                  data-testid={testId}
                  onClick={() => void send(gesture)}
                  className={`h-10 rounded-xl border border-white/10 text-[11px] font-semibold ${
                    gesture === "click" ? "col-span-2 bg-white text-black" : "bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{copy.preview}</p>
            <div
              data-testid="g2-canvas"
              className="mt-2 min-h-44 overflow-hidden rounded-xl border border-[#1f6b2a] bg-[#031406] p-3 font-mono text-[11px] leading-4 whitespace-pre-wrap text-[#b6ff6a] sm:text-xs sm:leading-5"
            >
              {view?.canvas ?? ""}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-zinc-500">{copy.apiLead}</p>
            <p className="mt-1 font-mono text-[11px] break-all text-zinc-300">{origin}/api/glasses/session</p>
            <p className="mt-3 text-[11px] leading-5 text-zinc-500">{copy.pluginLead}</p>
            <input
              readOnly
              value={pluginUrl}
              data-testid="glasses-plugin-url"
              aria-label={copy.pluginLead}
              className="mt-1 h-11 w-full rounded-xl border border-white/[0.08] bg-black px-3 font-mono text-[11px] text-zinc-300 outline-none"
            />
            <button type="button" onClick={() => void copyUrl()} className="mt-2 text-[11px] text-zinc-400 hover:text-white">
              {copied ? copy.copied : copy.copyUrl}
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}
