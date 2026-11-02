import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { applyRemoteAction, createRemoteHub, normalizePairCode, parseRole } from "./session.ts";

const hub = createRemoteHub();
const MAX_BODY = 4096;

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

export function createRelay() {
  return createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, CORS);
      response.end();
      return;
    }
    const url = new URL(request.url || "/", "http://127.0.0.1");
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

const port = Number(process.env.PORT || 8787);
createRelay().listen(port, "0.0.0.0", () => {
  console.log(`wrist remote relay http://0.0.0.0:${port}`);
});
