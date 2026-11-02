import { NextResponse } from "next/server";
import {
  applyGlassesAction,
  glassesHub,
  normalizePairCode,
  parseGlassesRole,
} from "@/lib/glasses-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const code = normalizePairCode(url.searchParams.get("code"));
  if (!code) return json({ error: "bad" }, 400);
  const result = glassesHub().read(code, parseGlassesRole(url.searchParams.get("role")), Date.now());
  if (result === "missing") return json({ error: "missing" }, 404);
  if (result === "busy") return json({ error: "busy" }, 429);
  return json(result);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad" }, 400);
  }
  const result = applyGlassesAction(glassesHub(), body, Date.now());
  if (result.status !== 200) return json({ error: result.error }, result.status);
  return json(result.view);
}
