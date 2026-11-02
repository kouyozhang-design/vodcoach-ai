import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import {
  glassesPageUrl,
  lanIPv4,
  patchAppJson,
  readHousehold,
  relayOrigin,
  relayOriginSource,
  watchConfigSource,
} from "./household.ts";
import { qrPng } from "./qr-image.ts";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);

function file(name: string) {
  return new URL(name, root);
}

const host = lanIPv4();
let previous: string | null = null;
try {
  previous = readFileSync(file(".wrist-remote.json"), "utf8");
} catch {
  previous = null;
}
const home = readHousehold(previous, host);
const api = relayOrigin(home.host);
writeFileSync(file(".wrist-remote.json"), `${JSON.stringify(home, null, 2)}\n`);
writeFileSync(file("app.json"), patchAppJson(readFileSync(file("app.json"), "utf8"), api));
writeFileSync(file("src/relay-origin.ts"), relayOriginSource(api));
writeFileSync(file("watch/WristRemote/LaunchConfig.swift"), watchConfigSource(api, home.code));

const children: ChildProcess[] = [];
let stopping = false;

function run(args: string[]) {
  const child = spawn(process.execPath, args, { cwd: rootPath, stdio: "inherit" });
  children.push(child);
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`stopped (${code ?? "signal"})`);
      stop(1);
    }
  });
  return child;
}

function reveal(target: string) {
  if (process.platform !== "darwin") return;
  const child = spawn("open", [target], { stdio: "ignore" });
  child.on("error", () => undefined);
}

function stop(code: number): never {
  if (!stopping) {
    stopping = true;
    for (const child of children) child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

if (process.platform === "darwin") {
  const stayAwake = spawn("caffeinate", ["-ims", "-w", String(process.pid)], { stdio: "ignore" });
  stayAwake.on("error", () => undefined);
}

run(["--experimental-strip-types", "src/relay.ts"]);
run([fileURLToPath(file("node_modules/vite/bin/vite.js")), "--host", "0.0.0.0", "--port", "5173"]);

async function waitUntilReady() {
  const checks = [`${api}/health`, "http://127.0.0.1:8787/health"];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    for (const check of checks) {
      try {
        const response = await fetch(check);
        if (response.ok) return;
      } catch {
        // The relay is still opening its port.
      }
    }
    await delay(200);
  }
  throw new Error("relay");
}

try {
  await waitUntilReady();
} catch {
  console.error("リレーが起動しませんでした");
  stop(1);
}
const joined = await fetch(`${api}/api/session`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "join", code: home.code, source: "watch" }),
});
if (!joined.ok) {
  console.error("コードを用意できませんでした");
  stop(1);
}

const page = glassesPageUrl(home);
const qrPath = fileURLToPath(file("glasses-qr.png"));
try {
  writeFileSync(file("glasses-qr.png"), await qrPng(page));
  reveal(qrPath);
  reveal(api);
} catch {
  console.error("QRの画像を作れませんでした");
}

console.log("");
console.log("白いQRの画像を開きました。その画像をスマホで読みます。");
console.log("画像    " + qrPath);
console.log("コード  " + home.code);
console.log("API    " + api);
console.log("案内    " + api);
console.log("メガネ  " + page);
console.log("Watch  even-hub/g2-watch/watch/WristRemote.xcodeproj");
console.log("");

await new Promise(() => {});
