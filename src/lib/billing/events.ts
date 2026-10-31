import { cleanEmail, stripeCustomerId, supabaseUserId } from "./ids.ts";

export type PlanStatus = "free" | "pro";

/** Signed-out and free still see the upload promo. Pro is profiles.status === "pro". */
export function showUploadPromo(status: PlanStatus | null): boolean {
  return status !== "pro";
}

export type StatusChange = {
  status: PlanStatus;
  userId: string | null;
  customerId: string | null;
  email: string | null;
};

const FREE_SUBSCRIPTION_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function metadataUserId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  return supabaseUserId((metadata as { supabase_user_id?: unknown }).supabase_user_id);
}

function objectRecord(event: { data?: { object?: unknown } }): Record<string, unknown> | null {
  const object = event.data?.object;
  if (!object || typeof object !== "object") return null;
  return object as Record<string, unknown>;
}

/**
 * Maps a verified Stripe event to a profile status change.
 * A browser return from Checkout is not an event and cannot grant Pro.
 */
export function statusChangeForEvent(event: { type?: unknown; data?: { object?: unknown } }): StatusChange | null {
  const type = text(event.type);
  const object = objectRecord(event);
  if (!type || !object) return null;

  const userId = metadataUserId(object.metadata) ?? supabaseUserId(object.client_reference_id);
  const customerId = stripeCustomerId(object.customer);
  const details = object.customer_details;
  const detailEmail = details && typeof details === "object" ? (details as { email?: unknown }).email : null;
  const email = cleanEmail(detailEmail) ?? cleanEmail(object.customer_email);

  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    if (object.mode !== "subscription") return null;
    if (object.payment_status !== "paid") return null;
    return { status: "pro", userId, customerId, email };
  }

  if (type === "customer.subscription.deleted") {
    return { status: "free", userId, customerId, email: null };
  }

  if (type === "customer.subscription.updated" || type === "customer.subscription.created") {
    if (object.status === "active") {
      return { status: "pro", userId, customerId, email: null };
    }
    if (typeof object.status === "string" && FREE_SUBSCRIPTION_STATUSES.has(object.status)) {
      return { status: "free", userId, customerId, email: null };
    }
    return null;
  }

  return null;
}

export type ProfileUpsert = {
  id: string;
  status: PlanStatus;
  email?: string;
  stripe_customer_id?: string;
};

export type ProfileWritePlan =
  | { kind: "user"; row: ProfileUpsert }
  | { kind: "customer"; customerId: string; status: PlanStatus };

export function profileWriteFor(change: StatusChange): ProfileWritePlan | null {
  if (change.userId) {
    const row: ProfileUpsert = { id: change.userId, status: change.status };
    if (change.email) row.email = change.email;
    if (change.customerId) row.stripe_customer_id = change.customerId;
    return { kind: "user", row };
  }
  if (change.customerId) {
    return { kind: "customer", customerId: change.customerId, status: change.status };
  }
  return null;
}

export type PublicBillingState = {
  configured: boolean;
  signedIn: boolean;
  status: PlanStatus | null;
  canManage: boolean;
  email: string | null;
};

export function publicBillingState(input: {
  configured: boolean;
  user: { id: string; email?: string | null } | null;
  profile: { status?: string | null; stripe_customer_id?: string | null } | null;
  readFailed: boolean;
}): PublicBillingState {
  if (!input.user) {
    return { configured: input.configured, signedIn: false, status: null, canManage: false, email: null };
  }
  const email = cleanEmail(input.user.email);
  if (input.readFailed || !input.profile) {
    return { configured: input.configured, signedIn: true, status: "free", canManage: false, email };
  }
  const status: PlanStatus = input.profile.status === "pro" ? "pro" : "free";
  const customerId = stripeCustomerId(input.profile.stripe_customer_id);
  return {
    configured: input.configured,
    signedIn: true,
    status,
    canManage: Boolean(customerId),
    email,
  };
}

export function normalizeBillingClientState(body: unknown): PublicBillingState {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const signedIn = record.signedIn === true;
  const status = signedIn && record.status === "pro" ? "pro" : signedIn ? "free" : null;
  return {
    configured: record.configured === true,
    signedIn,
    status,
    canManage: signedIn && record.canManage === true,
    email: signedIn ? cleanEmail(record.email) : null,
  };
}

export function noticeForCheckoutQuery(value: string | null): "returned" | "canceled" | null {
  if (value === "success") return "returned";
  if (value === "cancel") return "canceled";
  return null;
}
