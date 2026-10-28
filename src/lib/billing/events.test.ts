import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import Stripe from "stripe";
import { MANAGE_BUTTON_EN, MANAGE_BUTTON_JA, PRO_BUTTON_EN, PRO_BUTTON_JA, billingCopy } from "./copy.ts";
import { billingReturnOrigin, checkoutReady, checkoutSessionParams, priceIdFromEnv, webhookReady } from "./config.ts";
import { isStripeRedirect } from "./redirect.ts";
import {
  normalizeBillingClientState,
  noticeForCheckoutQuery,
  profileWriteFor,
  publicBillingState,
  statusChangeForEvent,
} from "./events.ts";
import { verifyStripeWebhook } from "./stripe-server.ts";

const USER = "11111111-1111-4111-8111-111111111111";

const readyEnv = {
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PRICE_ID: "price_example",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon_example",
  SUPABASE_SERVICE_ROLE_KEY: "service_role_example",
} as NodeJS.ProcessEnv;

test("price id comes only from STRIPE_PRICE_ID", () => {
  const clientBody = { priceId: "price_clienthack", price: "price_other", language: "en" };
  const priceId = priceIdFromEnv(readyEnv);
  assert.equal(priceId, "price_example");
  assert.equal(priceIdFromEnv({ STRIPE_PRICE_ID: "prod_not_a_price" } as NodeJS.ProcessEnv), null);
  assert.equal(priceIdFromEnv({} as NodeJS.ProcessEnv), null);
  const params = checkoutSessionParams({
    priceId: priceId ?? "",
    userId: USER,
    email: "player@example.com",
    customerId: null,
    origin: "https://vodcoach-ai.vercel.app",
    locale: "ja",
  });
  assert.equal(params.mode, "subscription");
  assert.equal(params.line_items[0]?.price, "price_example");
  assert.equal(params.metadata.supabase_user_id, USER);
  assert.equal(JSON.stringify(params).includes("price_clienthack"), false);
  assert.equal(JSON.stringify(params).includes(String(clientBody.price)), false);
});

test("checkout and webhook stay closed when any required env is missing", () => {
  assert.equal(checkoutReady(readyEnv), true);
  assert.equal(webhookReady(readyEnv), true);
  for (const key of Object.keys(readyEnv)) {
    const missing = { ...readyEnv, [key]: "" };
    if (key === "STRIPE_PRICE_ID" || key === "STRIPE_SECRET_KEY" || key === "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
      assert.equal(checkoutReady(missing), false);
    }
    if (key === "STRIPE_WEBHOOK_SECRET" || key === "SUPABASE_SERVICE_ROLE_KEY" || key === "NEXT_PUBLIC_SUPABASE_URL") {
      assert.equal(checkoutReady(missing), false);
      assert.equal(webhookReady(missing), false);
    }
  }
  assert.equal(checkoutReady({} as NodeJS.ProcessEnv), false);
  assert.equal(webhookReady({} as NodeJS.ProcessEnv), false);
});

test("only a paid subscription webhook grants pro", () => {
  const paid = statusChangeForEvent({
    type: "checkout.session.completed",
    data: {
      object: {
        mode: "subscription",
        payment_status: "paid",
        client_reference_id: USER,
        customer: "cus_123",
        customer_details: { email: "player@example.com" },
      },
    },
  });
  assert.equal(paid?.status, "pro");
  assert.equal(paid?.userId, USER);
  assert.deepEqual(profileWriteFor(paid!), {
    kind: "user",
    row: { id: USER, status: "pro", email: "player@example.com", stripe_customer_id: "cus_123" },
  });

  assert.equal(
    statusChangeForEvent({
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", payment_status: "unpaid", metadata: { supabase_user_id: USER } } },
    }),
    null,
  );
  assert.equal(
    statusChangeForEvent({
      type: "checkout.session.completed",
      data: { object: { mode: "payment", payment_status: "paid", metadata: { supabase_user_id: USER } } },
    }),
    null,
  );
  assert.equal(statusChangeForEvent({ type: "checkout.success_redirect", data: { object: { payment_status: "paid" } } }), null);
  assert.equal(noticeForCheckoutQuery("success"), "returned");
  assert.notEqual(noticeForCheckoutQuery("success"), "pro");

  const active = statusChangeForEvent({
    type: "customer.subscription.updated",
    data: { object: { status: "active", customer: "cus_123", metadata: { supabase_user_id: USER } } },
  });
  assert.equal(active?.status, "pro");
  assert.equal(
    statusChangeForEvent({
      type: "customer.subscription.updated",
      data: { object: { status: "trialing", customer: "cus_123", metadata: { supabase_user_id: USER } } },
    }),
    null,
  );
  assert.equal(
    statusChangeForEvent({
      type: "customer.subscription.updated",
      data: { object: { status: "active", cancel_at_period_end: true, metadata: { supabase_user_id: USER }, customer: "cus_123" } },
    })?.status,
    "pro",
  );
});

test("subscription delete or cancel returns free and never writes without an identity", () => {
  const deleted = statusChangeForEvent({
    type: "customer.subscription.deleted",
    data: { object: { status: "canceled", customer: "cus_123", metadata: { supabase_user_id: USER } } },
  });
  assert.equal(deleted?.status, "free");
  assert.equal(
    statusChangeForEvent({
      type: "customer.subscription.updated",
      data: { object: { status: "canceled", customer: "cus_123" } },
    })?.status,
    "free",
  );
  assert.equal(profileWriteFor({ status: "pro", userId: null, customerId: null, email: null }), null);
  assert.deepEqual(profileWriteFor({ status: "free", userId: null, customerId: "cus_123", email: null }), {
    kind: "customer",
    customerId: "cus_123",
    status: "free",
  });
});

test("status reads cannot invent pro", () => {
  assert.equal(
    publicBillingState({ configured: false, user: null, profile: { status: "pro" }, readFailed: false }).status,
    null,
  );
  assert.equal(
    publicBillingState({
      configured: true,
      user: { id: USER, email: "player@example.com" },
      profile: { status: "premium", stripe_customer_id: "cus_123" },
      readFailed: false,
    }).status,
    "free",
  );
  assert.equal(
    publicBillingState({
      configured: true,
      user: { id: USER },
      profile: null,
      readFailed: true,
    }).status,
    "free",
  );
  assert.equal(normalizeBillingClientState({ signedIn: false, status: "pro" }).status, null);
  assert.equal(normalizeBillingClientState({ signedIn: true, status: "pro" }).status, "pro");
});

test("stripe redirect hosts and production return origin are pinned", () => {
  assert.equal(isStripeRedirect("https://checkout.stripe.com/c/pay/cs_test", "checkout"), true);
  assert.equal(isStripeRedirect("https://billing.stripe.com/p/session/test", "portal"), true);
  assert.equal(isStripeRedirect("https://evil.example/checkout", "checkout"), false);
  assert.equal(isStripeRedirect("http://checkout.stripe.com/c/pay/cs_test", "checkout"), false);
  const origin = billingReturnOrigin(new Request("https://internal.local/"), {
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "vodcoach-ai.vercel.app",
  } as NodeJS.ProcessEnv);
  assert.equal(origin, "https://vodcoach-ai.vercel.app");
});

test("webhook signature is verified on the raw body", () => {
  const payload = JSON.stringify({
    id: "evt_test_deleted",
    object: "event",
    type: "customer.subscription.deleted",
    data: {
      object: {
        object: "subscription",
        status: "canceled",
        customer: "cus_123",
        metadata: { supabase_user_id: USER },
      },
    },
  });
  const secret = "whsec_test_only";
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const event = verifyStripeWebhook(payload, header, secret);
  assert.equal(event.type, "customer.subscription.deleted");
  assert.equal(statusChangeForEvent(event)?.status, "free");
  assert.throws(() => verifyStripeWebhook(payload, header, "whsec_wrong"));
  assert.throws(() => verifyStripeWebhook(payload, null, secret));
});

test("button labels follow the language toggle", () => {
  assert.equal(billingCopy("ja").becomePro, PRO_BUTTON_JA);
  assert.equal(billingCopy("en").becomePro, PRO_BUTTON_EN);
  assert.equal(billingCopy("ja").manage, MANAGE_BUTTON_JA);
  assert.equal(billingCopy("en").manage, MANAGE_BUTTON_EN);
});

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) found.push(path);
  }
  return found;
}

test("browser billing code does not touch server secrets", () => {
  const clientFiles = [
    "src/components/pro-plan-controls.tsx",
    "src/app/auth/page.tsx",
    "src/app/page.tsx",
    "src/components/home-screen.tsx",
    "src/lib/billing/events.ts",
    "src/lib/billing/redirect.ts",
    "src/lib/billing/ids.ts",
    "src/lib/billing/copy.ts",
  ];
  for (const path of clientFiles) {
    const source = readFileSync(path, "utf8");
    assert.equal(source.includes("process.env"), false, path);
    assert.equal(source.includes("billing/config"), false, path);
    assert.equal(source.includes("supabase/admin"), false, path);
    assert.equal(source.includes("stripe-server"), false, path);
    assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false, path);
    assert.equal(source.includes("STRIPE_SECRET_KEY"), false, path);
  }
});

test("only the stripe webhook writes profile status", () => {
  const writers = sourceFiles("src")
    .filter((path) => !path.endsWith(".test.ts"))
    .filter((path) => readFileSync(path, "utf8").includes("writeProfileStatus"))
    .sort();
  assert.deepEqual(writers, ["src/app/api/stripe/webhook/route.ts", "src/lib/billing/profile.ts"]);
});
