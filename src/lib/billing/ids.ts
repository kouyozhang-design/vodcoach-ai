const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUSTOMER_ID = /^cus_[A-Za-z0-9]+$/;

export function supabaseUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!USER_ID.test(id)) return null;
  return id;
}

export function stripeCustomerId(value: unknown): string | null {
  if (typeof value === "string" && CUSTOMER_ID.test(value)) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && CUSTOMER_ID.test(id)) return id;
  }
  return null;
}

export function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
