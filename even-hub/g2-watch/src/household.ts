import { networkInterfaces } from "node:os";
import { normalizePairCode, randomPairCode } from "./session.ts";

type LanEntry = {
  name: string;
  address: string;
  internal: boolean;
  family: string | number;
};

export type Household = {
  code: string;
  host: string;
};

const RELAY_PORT = 8787;
const DEV_PORT = 5173;

export function chooseLanIPv4(entries: LanEntry[]): string {
  const usable = entries.filter((entry) => !entry.internal && isIPv4(entry) && !isVirtual(entry.name));
  const home = usable.find((entry) => entry.address.startsWith("192.168.") || entry.address.startsWith("10."));
  const local = usable.find((entry) => isPrivate(entry.address));
  return (home ?? local ?? usable[0])?.address ?? "127.0.0.1";
}

export function lanIPv4() {
  const entries = Object.entries(networkInterfaces()).flatMap(([name, list]) =>
    (list ?? []).map((entry) => ({ name, address: entry.address, internal: entry.internal, family: entry.family })),
  );
  return chooseLanIPv4(entries);
}

export function relayOrigin(host: string) {
  return `http://${host}:${RELAY_PORT}`;
}

export function glassesPageUrl(home: Household) {
  const api = relayOrigin(home.host);
  const query = new URLSearchParams({ api, code: home.code });
  return `http://${home.host}:${DEV_PORT}/?${query.toString()}`;
}

export function loadHousehold(text: string): Household | null {
  try {
    const parsed = JSON.parse(text) as { code?: unknown; host?: unknown };
    const code = typeof parsed.code === "string" ? normalizePairCode(parsed.code) : null;
    const host = typeof parsed.host === "string" && isHost(parsed.host) ? parsed.host : null;
    if (!code || !host) return null;
    return { code, host };
  } catch {
    return null;
  }
}

export function readHousehold(text: string | null, host: string): Household {
  const saved = text ? loadHousehold(text) : null;
  return { code: saved?.code ?? randomPairCode(), host };
}

export function patchAppJson(text: string, origin: string) {
  const app = JSON.parse(text) as {
    permissions?: { name?: string; whitelist?: unknown }[];
  };
  const network = app.permissions?.find((permission) => permission.name === "network");
  if (network) {
    const current = Array.isArray(network.whitelist)
      ? network.whitelist.filter((item): item is string => typeof item === "string")
      : [];
    if (!current.includes(origin)) current.push(origin);
    network.whitelist = current;
  }
  return `${JSON.stringify(app, null, 2)}\n`;
}

export function relayOriginSource(origin: string) {
  return `/** Written by npm start so the glasses can reach this Mac. */\nexport const RELAY_ORIGIN = ${JSON.stringify(origin)};\n`;
}

export function watchConfigSource(api: string, code: string) {
  return [
    "// Written by npm start. Xcode reads this the next time the Watch app is run.",
    "enum LaunchConfig {",
    `  static let api = ${JSON.stringify(api)}`,
    `  static let code = ${JSON.stringify(code)}`,
    "}",
    "",
  ].join("\n");
}

function isHost(value: string) {
  return /^[A-Za-z0-9.-]+$/.test(value) && value.length <= 253;
}

function isIPv4(entry: LanEntry) {
  return entry.family === "IPv4" || entry.family === 4;
}

function isVirtual(name: string) {
  return /^(docker|br-|veth|tun|awdl|utun|llw|bridge|cni)/.test(name);
}

function isPrivate(address: string) {
  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}
