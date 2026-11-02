/**
 * Apple Watch Series 8 operates one Even Hub page on Even G2.
 * Text brightness in SDK 0.0.16 is 0–4. 0 is fully dim, so the watch stops at 1.
 * Temple event numbers match OsEventTypeList. The SDK may omit click (0).
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
export type RemoteRole = "watch" | "glasses";
export type RemoteMode = "pair" | "menu" | "page";

export const TEXT_MIN = 1;
export const TEXT_MAX = 4;
export const MENU = ["明るさ", "メモ", "接続"] as const;
const CODE_LENGTH = 4;
const TTL_MS = 45 * 60 * 1000;
const SEEN_MS = 8_000;
const FAIL_WINDOW_MS = 60_000;
const FAIL_LIMIT = 40;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type RemoteView = {
  code: string;
  canvas: string;
  textColor: number;
  revision: number;
  mode: RemoteMode;
  index: number;
  label: string;
  watchConnected: boolean;
  glassesConnected: boolean;
};

type Session = {
  code: string;
  mode: RemoteMode;
  index: number;
  textColor: number;
  revision: number;
  signature: string;
  lastGesture: WatchGesture | null;
  watchSeenAt: number | null;
  glassesSeenAt: number | null;
  touchedAt: number;
};

export type RemoteRead = RemoteView | "missing" | "busy";

export function parseWatchGesture(value: unknown): WatchGesture | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return (WATCH_GESTURES as readonly string[]).includes(trimmed) ? (trimmed as WatchGesture) : null;
}

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

export function parseRole(value: unknown): RemoteRole | null {
  return value === "watch" || value === "glasses" ? value : null;
}

export function normalizePairCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z2-9]{4}$/.test(code) || /[01IO]/.test(code)) return null;
  return code;
}

export function renderRemoteCanvas(session: Pick<Session, "mode" | "code" | "index" | "textColor">, watchConnected: boolean) {
  const color = `明${session.textColor}`;
  if (session.mode === "pair") {
    return ["Watch 8", session.code, color, "", "Watchにこのコード", "タップでメニュー"].join("\n");
  }
  if (session.mode === "menu") {
    const lines = MENU.map((label, index) => `${index === session.index ? ">" : " "} ${label}`);
    return ["Watch 8", color, "", ...lines, "", "タップ 開く", "クラウン 選ぶ", "長押し コード"].join("\n");
  }
  const label = MENU[session.index] ?? MENU[0];
  if (label === "明るさ") return ["明るさ", color, "", "クラウンで変更", "ダブルで戻る"].join("\n");
  if (label === "メモ") return ["メモ", color, "", "Watchで操作中", "ダブルで戻る"].join("\n");
  return ["接続", color, "", watchConnected ? "Watch 接続" : "Watch 待機", "ダブルで戻る"].join("\n");
}

function commit(session: Session, now: number) {
  const watchConnected = session.watchSeenAt != null && now - session.watchSeenAt <= SEEN_MS;
  const signature = `${session.textColor}\n${renderRemoteCanvas(session, watchConnected)}`;
  if (signature === session.signature) return;
  session.signature = signature;
  session.revision += 1;
}

function mark(session: Session, role: RemoteRole | null, now: number) {
  if (role === "watch") session.watchSeenAt = now;
  if (role === "glasses") session.glassesSeenAt = now;
  session.touchedAt = now;
}

function toView(session: Session, now: number): RemoteView {
  const watchConnected = session.watchSeenAt != null && now - session.watchSeenAt <= SEEN_MS;
  const glassesConnected = session.glassesSeenAt != null && now - session.glassesSeenAt <= SEEN_MS;
  return {
    code: session.code,
    canvas: renderRemoteCanvas(session, watchConnected),
    textColor: session.textColor,
    revision: session.revision,
    mode: session.mode,
    index: session.mode === "pair" ? 0 : session.index,
    label: session.mode === "pair" ? "" : MENU[session.index] ?? "",
    watchConnected,
    glassesConnected,
  };
}

function randomCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

function selected(session: Session) {
  return MENU[session.index] ?? MENU[0];
}

function applyGesture(session: Session, gesture: WatchGesture) {
  session.lastGesture = gesture;
  switch (gesture) {
    case "click":
      if (session.mode === "pair" || session.mode === "menu") {
        session.mode = session.mode === "pair" ? "menu" : "page";
      }
      break;
    case "double-click":
      if (session.mode === "page") session.mode = "menu";
      else if (session.mode === "menu") session.mode = "pair";
      break;
    case "scroll-up":
      if (session.mode === "menu") session.index = Math.max(0, session.index - 1);
      else if (session.mode === "page" && selected(session) === "明るさ") {
        session.textColor = Math.min(TEXT_MAX, session.textColor + 1);
      }
      break;
    case "scroll-down":
      if (session.mode === "menu") session.index = Math.min(MENU.length - 1, session.index + 1);
      else if (session.mode === "page" && selected(session) === "明るさ") {
        session.textColor = Math.max(TEXT_MIN, session.textColor - 1);
      }
      break;
    case "long-press":
      session.mode = "pair";
      break;
    case "long-press-release":
      break;
    case "brighter":
      session.textColor = Math.min(TEXT_MAX, session.textColor + 1);
      break;
    case "dimmer":
      session.textColor = Math.max(TEXT_MIN, session.textColor - 1);
      break;
    default:
      break;
  }
}

export function createRemoteHub() {
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
    if (!session || now - session.touchedAt > TTL_MS) {
      if (session) sessions.delete(code);
      return null;
    }
    return session;
  }

  return {
    open(now: number): RemoteView {
      sweep(now);
      let code = randomCode();
      while (sessions.has(code)) code = randomCode();
      const session: Session = {
        code,
        mode: "pair",
        index: 0,
        textColor: TEXT_MAX,
        revision: 0,
        signature: "",
        lastGesture: null,
        watchSeenAt: null,
        glassesSeenAt: null,
        touchedAt: now,
      };
      commit(session, now);
      sessions.set(code, session);
      return toView(session, now);
    },
    read(code: string, role: RemoteRole | null, now: number): RemoteRead {
      const session = take(code, now);
      if (!session) return limited(now) ? "busy" : "missing";
      mark(session, role, now);
      commit(session, now);
      return toView(session, now);
    },
    gesture(code: string, gesture: WatchGesture, role: RemoteRole | null, now: number): RemoteRead {
      const session = take(code, now);
      if (!session) return limited(now) ? "busy" : "missing";
      applyGesture(session, gesture);
      mark(session, role, now);
      commit(session, now);
      return toView(session, now);
    },
  };
}

export type RemoteHub = ReturnType<typeof createRemoteHub>;

export type RemoteActionResult =
  | { status: 200; view: RemoteView }
  | { status: 400 | 404 | 429; error: "bad" | "missing" | "busy" };

function fromRead(result: RemoteRead): RemoteActionResult {
  if (result === "missing") return { status: 404, error: "missing" };
  if (result === "busy") return { status: 429, error: "busy" };
  return { status: 200, view: result };
}

export function applyRemoteAction(hub: RemoteHub, body: unknown, now: number): RemoteActionResult {
  if (!body || typeof body !== "object") return { status: 400, error: "bad" };
  const record = body as Record<string, unknown>;
  if (record.action === "open") return { status: 200, view: hub.open(now) };
  const code = normalizePairCode(record.code);
  if (!code) return { status: 400, error: "bad" };
  const role = parseRole(record.source) ?? parseRole(record.role);
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
