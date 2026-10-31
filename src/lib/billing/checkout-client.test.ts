import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { interpretCheckoutResponse } from "./checkout-client.ts";

test("checkout stays fail-closed until Stripe returns a real session URL", () => {
  assert.equal(interpretCheckoutResponse(401, { error: "sign_in_required" }).kind, "auth");
  assert.equal(interpretCheckoutResponse(503, { error: "billing_not_configured" }).kind, "not_configured");
  assert.equal(interpretCheckoutResponse(503, null).kind, "not_configured");
  assert.equal(interpretCheckoutResponse(409, { error: "no_billing_account" }).kind, "no_account");
  assert.equal(interpretCheckoutResponse(200, { url: "https://evil.example/checkout" }).kind, "failed");
  assert.equal(interpretCheckoutResponse(200, { url: "https://vodcoach-ai.vercel.app/?checkout=success" }).kind, "failed");
  assert.equal(interpretCheckoutResponse(200, {}).kind, "failed");
  assert.equal(interpretCheckoutResponse(502, { error: "checkout_failed" }).kind, "failed");
  const ready = interpretCheckoutResponse(200, { url: "https://checkout.stripe.com/c/pay/cs_test" });
  assert.deepEqual(ready, { kind: "url", url: "https://checkout.stripe.com/c/pay/cs_test" });
});

test("node stays on 24 and Next is not bumped in this change", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as {
    engines: { node: string };
    dependencies: { next: string };
  };
  assert.equal(pkg.engines.node, "24.x");
  assert.equal(pkg.dependencies.next, "16.4.0");
});
