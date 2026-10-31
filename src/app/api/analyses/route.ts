import { NextResponse } from "next/server";
import { accountRecordBody, parseAccountRecord } from "@/lib/account-analyses";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

async function sessionUser() {
  const supabase = await createSupabaseServer();
  if (!supabase) return { supabase: null, userId: null as string | null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

export async function GET() {
  const { supabase, userId } = await sessionUser();
  if (!supabase) return json({ error: "unconfigured" }, 503);
  if (!userId) return json({ error: "signed_out" }, 401);
  const { data, error } = await supabase
    .from("saved_analyses")
    .select("payload")
    .eq("user_id", userId);
  if (error) return json({ error: "store" }, 500);
  const analyses = (data ?? []).flatMap((row) => {
    const parsed = parseAccountRecord(row.payload);
    return parsed ? [parsed] : [];
  });
  return json({ analyses });
}

export async function PUT(request: Request) {
  const { supabase, userId } = await sessionUser();
  if (!supabase) return json({ error: "unconfigured" }, 503);
  if (!userId) return json({ error: "signed_out" }, 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad" }, 400);
  }
  const record = accountRecordBody(body);
  if (!record) return json({ error: "bad" }, 400);
  const { error } = await supabase.from("saved_analyses").upsert(
    {
      user_id: userId,
      id: record.id,
      saved_at: new Date(record.savedAt).toISOString(),
      updated_at: new Date(record.updatedAt).toISOString(),
      payload: record,
    },
    { onConflict: "user_id,id" },
  );
  if (error) return json({ error: "store" }, 500);
  return json({ id: record.id });
}

export async function DELETE(request: Request) {
  const { supabase, userId } = await sessionUser();
  if (!supabase) return json({ error: "unconfigured" }, 503);
  if (!userId) return json({ error: "signed_out" }, 401);
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return json({ error: "bad" }, 400);
  const { error } = await supabase.from("saved_analyses").delete().eq("user_id", userId).eq("id", id);
  if (error) return json({ error: "store" }, 500);
  return json({ id });
}
