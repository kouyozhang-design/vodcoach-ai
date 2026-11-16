import { NextResponse } from "next/server";
import { allowUserRequest } from "@/lib/request-limit";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function requireSignedInUserId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", userId).maybeSingle();
  const plan = profile?.status === "pro" ? "pro" : "free";
  return `${plan}:${userId}`;
}

export async function gatePaidCaller(bucket: string, freeLimit: number, proLimit: number, windowMs: number) {
  const identity = await requireSignedInUserId();
  if (!identity) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }
  const splitAt = identity.indexOf(":");
  const plan = identity.slice(0, splitAt);
  const userId = identity.slice(splitAt + 1);
  const limit = plan === "pro" ? proLimit : freeLimit;
  if (!allowUserRequest(`${bucket}:${userId}`, limit, windowMs)) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。少し待ってからもう一度お試しください。" },
      { status: 429 },
    );
  }
  return null;
}
