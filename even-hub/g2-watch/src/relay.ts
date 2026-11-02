import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { glassesPageUrl, loadHousehold, type Household } from "./household.ts";
import { applyRemoteAction, createRemoteHub, normalizePairCode, parseRole } from "./session.ts";
import { qrPng } from "./qr-image.ts";
import { renderSetupPage } from "./setup-page.ts";

const hub = createRemoteHub();
const MAX_BODY = 4096;
const householdPath = new URL("../.wrist-remote.json", import.meta.url);

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function send(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, { ...CORS, "Content-Type": "application/json" });
  response.end(payload);
}

function readBody(request: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("bad"));
      }
    });
    request.on("error", reject);
  });
}

function savedHousehold(): Household | null {
  try {
    const home = loadHousehold(readFileSync(householdPath, "utf8"));
    return home;
  } catch {
    return null;
  }
}

async function qrImage(value: string) {
  try {
    const png = await qrPng(value);
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return "";
  }
}

export function createRelay() {
  const home = savedHousehold();
  if (home) hub.ensure(home.code, null, Date.now());

  return createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, CORS);
      response.end();
      return;
    }
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/health") {
      send(response, 200, { ok: true });
      return;
    }
    if (url.pathname === "/") {
      const current = savedHousehold();
      if (!current) {
        response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("npm start で起動してください");
        return;
      }
      hub.ensure(current.code, null, Date.now());
      const page = renderSetupPage(current, await qrImage(glassesPageUrl(current)));
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(page);
      return;
    }
    if (url.pathname !== "/api/session") {
      send(response, 404, { error: "missing" });
      return;
    }
    if (request.method === "GET") {
      const code = normalizePairCode(url.searchParams.get("code"));
      if (!code) {
        send(response, 400, { error: "bad" });
        return;
      }
      const result = hub.read(code, parseRole(url.searchParams.get("role")), Date.now());
      if (result === "missing") send(response, 404, { error: "missing" });
      else if (result === "busy") send(response, 429, { error: "busy" });
      else send(response, 200, result);
      return;
    }
    if (request.method !== "POST") {
      send(response, 400, { error: "bad" });
      return;
    }
    let body: unknown;
    try {
      body = await readBody(request);
    } catch {
      send(response, 400, { error: "bad" });
      return;
    }
    const result = applyRemoteAction(hub, body, Date.now());
    if (result.status !== 200) send(response, result.status, { error: result.error });
    else send(response, 200, result.view);
  });
}

const isMain = process.argv[1]?.endsWith("relay.ts") === true;
if (isMain) {
  const port = Number(process.env.PORT || 8787);
  createRelay().listen(port, "0.0.0.0", () => {
    console.log(`wrist remote relay http://0.0.0.0:${port}`);
  });
}
