import { NextResponse } from "next/server";
import { hasBlobToken } from "@/lib/blob";
import { buildShareSnapshot, sharePagePath } from "@/lib/share-snapshot";
import { writeShareSnapshot } from "@/lib/share-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  if (!hasBlobToken()) return json({ error: "unconfigured" }, 503);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad" }, 400);
  }
  const snapshot = buildShareSnapshot(body, crypto.randomUUID());
  if (!snapshot) return json({ error: "bad" }, 400);
  try {
    const wrote = await writeShareSnapshot(snapshot);
    if (!wrote) return json({ error: "unconfigured" }, 503);
  } catch {
    return json({ error: "store" }, 500);
  }
  return json({ id: snapshot.id, path: sharePagePath(snapshot.id) });
}
