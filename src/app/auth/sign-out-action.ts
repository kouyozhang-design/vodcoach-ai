"use server";

import { redirect } from "next/navigation";
import { endServerSession } from "@/lib/sign-out";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function signOutToHome() {
  await endServerSession(await createSupabaseServer());
  redirect("/");
}
