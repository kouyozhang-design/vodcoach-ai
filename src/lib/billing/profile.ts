import { createServiceRoleClient } from "../supabase/admin.ts";
import type { ProfileWritePlan } from "./events.ts";

export async function writeProfileStatus(plan: ProfileWritePlan): Promise<"ok" | "missing"> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service_role_missing");
  const updatedAt = new Date().toISOString();
  if (plan.kind === "user") {
    const { error } = await admin.from("profiles").upsert({ ...plan.row, updated_at: updatedAt }, { onConflict: "id" });
    if (error) throw error;
    return "ok";
  }
  const { data, error } = await admin
    .from("profiles")
    .update({ status: plan.status, updated_at: updatedAt })
    .eq("stripe_customer_id", plan.customerId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) return "missing";
  return "ok";
}
