import { glassesCopy, isCoachLanguage } from "./glasses-copy.ts";
import type { CoachLanguage } from "./coach-language.ts";
import { DEFAULT_COACH_LANGUAGE } from "./coach-language.ts";

/**
 * Apple Watch Series 8 drives an Even G2 page through Even Hub.
 * G2 text brightness in SDK 0.0.16 is 0–4. 0 is fully dim, so the watch stops at 1.
 * Temple event numbers match OsEventTypeList: click 0, scroll up 1, scroll down 2,
 * double-click 3, long press 9, long-press release 10. The SDK may omit 0.
 */
export const WATCH_GESTURES = [
  "click",
  "double-click",
  "scroll-up",
  "scroll-down",
  "long-press",
  "long-press-release",
  "brighter",
  "dimmer",
] as const;

export type WatchGesture = (typeof WATCH_GESTURES)[number];
export type GlassesRole = "watch" | "glasses";
export type GlassesMode = "standby" | "cue";

export const GLASSES_TEXT_MIN = 1;
export const GLASSES_TEXT_MAX = 4;
export const GLASSES_CODE_LENGTH = 4;
export const GLASSES_CANVAS_LIMIT = 480;
const HISTORY_LIMIT = 8;
const CUE_LIMIT = 96;
const TTL_MS = 45 * 60 * 1000;
const SEEN_MS = 8_000;
const FAIL_WINDOW_MS = 60_000;
const FAIL_LIMIT = 40;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type GlassesView = {
  code: string;
  canvas: string;
  textColor: number;
  revision: number;
  mode: GlassesMode;
  pinned: boolean;
  index: number;
  count: number;
  line: string;
  language: CoachLanguage;
  lastGesture: WatchGesture | null;
  watchConnected: boolean;
  glassesConnected: boolean;
  updatedAt: number;
};

type Session = {
  code: string;
  cues: string[];
  index: number;
  pinned: boolean;
  mode: GlassesMode;
  textColor: number;
  language: CoachLanguage;
  revision: number;
  signature: string;
  lastGesture: WatchGesture | null;
  watchSeenAt: number | null;
  glassesSeenAt: number | null;
  touchedAt: number;
};

export type GlassesRead = GlassesView | "missing" | "busy";

export function parseWatchGesture(value: unknown): WatchGesture | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return (WATCH_GESTURES as readonly string[]).includes(trimmed) ? (trimmed as WatchGesture) : null;
}

/** Map a G2 temple / R1 eventType onto the same gesture the watch sends. */
export function gestureFromTemple(eventType: unknown): WatchGesture | null {
  if (eventType === undefined || eventType === null || eventType === "") return "click";
  const code = typeof eventType === "number" ? eventType : Number(eventType);
  if (!Number.isInteger(code)) return null;
  switch (code) {
    case 0:
      return "click";
    case 1:
      return "scroll-up";
    case 2:
      return "scroll-down";
    case 3:
      return "double-click";
    case 9:
      return "long-press";
    case 10:
      return "long-press-release";
    default:
      return null;
  }
}

export function parseGlassesRole(value: unknown): GlassesRole | null {
  return value === "watch" || value === "glasses" ? value : null;
}

export function normalizePairCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z2-9]{4}$/.test(code) || /[01IO]/.test(code)) return null;
  return code;
}

export function glassesPluginUrl(apiOrigin: string, code: string) {
  const api = new URL(apiOrigin);
  const plugin = new URL(api.origin);
  plugin.port = "5173";
  plugin.pathname = "/";
  plugin.searchParams.set("code", code);
  plugin.searchParams.set("api", api.origin);
  return plugin.toString();
}

export function renderGlassesCanvas(session: Pick<Session, "mode" | "cues" | "index" | "pinned" | "textColor" | "language">) {
  const copy = glassesCopy(session.language);
  const color = `${copy.lensBright}${session.textColor}`;
  const pin = session.pinned ? ` ${copy.lensPin}` : "";
  const showing = session.mode === "cue" && session.cues.length > 0;
  const canvas = showing
    ? [
        "Watch 8",
        `${copy.lensCue} ${session.index + 1}/${session.cues.length}${pin}`,
        color,
        "",
        session.cues[session.index] ?? "",
        "",
        copy.lensTapNext,
        copy.lensDouble,
        copy.lensCrown,
        copy.lensHold,
      ].join("\n")
    : [
        "Watch 8",
        `${copy.lensStandby}${pin}`,
        color,
        "",
        session.cues.length === 0 ? copy.lensEmpty : `${copy.lensHistory} ${session.cues.length}`,
        copy.lensTapBack,
      ].join("\n");
  return canvas.length <= GLASSES_CANVAS_LIMIT ? canvas : canvas.slice(0, GLASSES_CANVAS_LIMIT);
}

function clampCue(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length <= CUE_LIMIT ? compact : compact.slice(0, CUE_LIMIT).trim();
}

function commit(session: Session) {
  const signature = `${session.textColor}\n${session.language}\n${renderGlassesCanvas(session)}`;
  if (signature === session.signature) return;
  session.signature = signature;
  session.revision += 1;
}

function mark(session: Session, role: GlassesRole | null, now: number) {
  if (role === "watch") session.watchSeenAt = now;
  if (role === "glasses") session.glassesSeenAt = now;
  session.touchedAt = now;
}

function toView(session: Session, now: number): GlassesView {
  const count = session.cues.length;
  const live = session.mode === "cue" && count > 0;
  return {
    code: session.code,
    canvas: renderGlassesCanvas(session),
    textColor: session.textColor,
    revision: session.revision,
    mode: live ? "cue" : "standby",
    pinned: session.pinned,
    index: count === 0 ? 0 : session.index,
    count,
    line: live ? session.cues[session.index] ?? "" : "",
    language: session.language,
    lastGesture: session.lastGesture,
    watchConnected: session.watchSeenAt != null && now - session.watchSeenAt <= SEEN_MS,
    glassesConnected: session.glassesSeenAt != null && now - session.glassesSeenAt <= SEEN_MS,
    updatedAt: session.touchedAt,
  };
}

function randomCode() {
  const bytes = new Uint8Array(GLASSES_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

function applyGesture(session: Session, gesture: WatchGesture) {
  session.lastGesture = gesture;
  const count = session.cues.length;
  switch (gesture) {
    case "click":
      if (count === 0) break;
      if (session.mode === "standby") {
        session.mode = "cue";
        session.index = count - 1;
      } else if (session.index < count - 1) {
        session.index += 1;
      }
      break;
    case "double-click":
      session.pinned = !session.pinned;
      break;
    case "scroll-up":
      if (count === 0) break;
      if (session.mode === "standby") {
        session.mode = "cue";
        session.index = count - 1;
      } else {
        session.index = Math.max(0, session.index - 1);
      }
      break;
    case "scroll-down":
      if (count === 0) break;
      if (session.mode === "standby") {
        session.mode = "cue";
        session.index = count - 1;
      } else {
        session.index = Math.min(count - 1, session.index + 1);
      }
      break;
    case "long-press":
      session.mode = "standby";
      break;
    case "long-press-release":
      break;
    case "brighter":
      session.textColor = Math.min(GLASSES_TEXT_MAX, session.textColor + 1);
      break;
    case "dimmer":
      session.textColor = Math.max(GLASSES_TEXT_MIN, session.textColor - 1);
      break;
    default:
      break;
  }
}

export function createGlassesHub() {
  const sessions = new Map<string, Session>();
  const failures: number[] = [];

  function sweep(now: number) {
    for (const [code, session] of sessions) {
      if (now - session.touchedAt > TTL_MS) sessions.delete(code);
    }
  }

  function limited(now: number) {
    while (failures.length > 0 && now - failures[0] >= FAIL_WINDOW_MS) failures.shift();
    if (failures.length >= FAIL_LIMIT) return true;
    failures.push(now);
    return false;
  }

  function take(code: string, now: number) {
    sweep(now);
    const session = sessions.get(code);
    if (!session) return null;
    if (now - session.touchedAt > TTL_MS) {
      sessions.delete(code);
      return null;
    }
    return session;
  }

  function open(now: number, language: CoachLanguage): GlassesView {
    sweep(now);
    let code = randomCode();
    while (sessions.has(code)) code = randomCode();
    const session: Session = {
      code,
      cues: [],
      index: 0,
      pinned: false,
      mode: "standby",
      textColor: GLASSES_TEXT_MAX,
      language,
      revision: 0,
      signature: "",
      lastGesture: null,
      watchSeenAt: null,
      glassesSeenAt: null,
      touchedAt: now,
    };
    commit(session);
    sessions.set(code, session);
    return toView(session, now);
  }

  return {
    open,
    read(code: string, role: GlassesRole | null, now: number): GlassesRead {
      const session = take(code, now);
      if (!session) return limited(now) ? "busy" : "missing";
      mark(session, role, now);
      return toView(session, now);
    },
    line(code: string, text: string, now: number): GlassesRead {
      const session = take(code, now);
      if (!session) return limited(now) ? "busy" : "missing";
      const cue = clampCue(text);
      mark(session, null, now);
      if (!cue || session.cues[session.cues.length - 1] === cue) return toView(session, now);
      session.cues.push(cue);
      if (session.cues.length > HISTORY_LIMIT) {
        const drop = session.cues.length - HISTORY_LIMIT;
        session.cues.splice(0, drop);
        session.index = Math.max(0, session.index - drop);
      }
      if (!session.pinned) {
        session.index = session.cues.length - 1;
        session.mode = "cue";
      } else if (session.index >= session.cues.length) {
        session.index = session.cues.length - 1;
      }
      commit(session);
      return toView(session, now);
    },
    gesture(code: string, gesture: WatchGesture, role: GlassesRole | null, now: number): GlassesRead {
      const session = take(code, now);
      if (!session) return limited(now) ? "busy" : "missing";
      applyGesture(session, gesture);
      mark(session, role, now);
      commit(session);
      return toView(session, now);
    },
    language(code: string, language: CoachLanguage, now: number): GlassesRead {
      const session = take(code, now);
      if (!session) return limited(now) ? "busy" : "missing";
      session.language = language;
      mark(session, null, now);
      commit(session);
      return toView(session, now);
    },
  };
}

export type GlassesHub = ReturnType<typeof createGlassesHub>;

const HUB_KEY = Symbol.for("vodcoach.glassesHub");

export function glassesHub(): GlassesHub {
  const bag = globalThis as typeof globalThis & { [HUB_KEY]?: GlassesHub };
  if (!bag[HUB_KEY]) bag[HUB_KEY] = createGlassesHub();
  return bag[HUB_KEY];
}

export type GlassesActionResult =
  | { status: 200; view: GlassesView }
  | { status: 400 | 404 | 429; error: "bad" | "missing" | "busy" };

function fromRead(result: GlassesRead): GlassesActionResult {
  if (result === "missing") return { status: 404, error: "missing" };
  if (result === "busy") return { status: 429, error: "busy" };
  return { status: 200, view: result };
}

function languageOf(value: unknown): CoachLanguage {
  return isCoachLanguage(value) ? value : DEFAULT_COACH_LANGUAGE;
}

export function applyGlassesAction(hub: GlassesHub, body: unknown, now: number): GlassesActionResult {
  if (!body || typeof body !== "object") return { status: 400, error: "bad" };
  const record = body as Record<string, unknown>;
  if (record.action === "open") return { status: 200, view: hub.open(now, languageOf(record.language)) };
  const code = normalizePairCode(record.code);
  if (!code) return { status: 400, error: "bad" };
  const role = parseGlassesRole(record.source);
  if (record.action === "line") {
    if (typeof record.line !== "string") return { status: 400, error: "bad" };
    return fromRead(hub.line(code, record.line, now));
  }
  if (record.action === "language") return fromRead(hub.language(code, languageOf(record.language), now));
  if (record.action === "ping") return fromRead(hub.read(code, role, now));
  if (record.action === "gesture") {
    const gesture = parseWatchGesture(record.gesture) ?? (
      record.eventType !== undefined || record.source === "glasses" ? gestureFromTemple(record.eventType) : null
    );
    if (!gesture) return { status: 400, error: "bad" };
    return fromRead(hub.gesture(code, gesture, role, now));
  }
  return { status: 400, error: "bad" };
}
