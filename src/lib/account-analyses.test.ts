import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { accountRecordBody, planAccountSync, recordFromAccount } from "./account-analyses.ts";
import type { SavedCoachingRecord } from "./saved-coaching.ts";

function row(patch: Partial<SavedCoachingRecord> & Pick<SavedCoachingRecord, "id">): SavedCoachingRecord {
  return {
    id: patch.id,
    savedAt: patch.savedAt ?? 10,
    updatedAt: patch.updatedAt ?? 10,
    game: patch.game ?? "apex-legends",
    character: patch.character ?? "Wraith",
    rank: patch.rank ?? "Gold",
    concern: patch.concern ?? "近距離",
    sourceLanguage: patch.sourceLanguage ?? "ja",
    result: patch.result ?? {
      analysisId: patch.id,
      game: "apex-legends",
      character: "Wraith",
      headline: "岩",
      summary: "2射線を同時に開いた",
      insights: [{ id: "wide", title: "ワイド", finding: "2射線", action: "片側から" }],
    },
    translations: patch.translations ?? {},
    pendingAccount: patch.pendingAccount,
    accountCopy: patch.accountCopy,
    remoteVideoUrl: patch.remoteVideoUrl,
  };
}

test("a signed-out row stays on the device and is not uploaded", () => {
  const local = row({ id: "device" });
  const plan = planAccountSync([local], []);
  assert.deepEqual(plan.upload.map((item) => item.id), []);
  assert.deepEqual(plan.download, []);
  assert.deepEqual(plan.dropLocalIds, []);
});

test("a signed-in pending row uploads, and a newer account row downloads with its insights", () => {
  const pending = row({ id: "pending", pendingAccount: true, updatedAt: 20 });
  const remote = row({ id: "other", updatedAt: 30, savedAt: 30 });
  remote.result = {
    ...remote.result,
    headline: "漁夫",
    summary: "ノック後に下がった",
    insights: [{ id: "third", title: "漁夫", finding: "銃声が残っている", action: "確殺せずに切る" }],
  };
  const plan = planAccountSync([pending], [remote]);
  assert.deepEqual(plan.upload.map((item) => item.id), ["pending"]);
  assert.equal(plan.download[0]?.id, "other");
  assert.equal(plan.download[0]?.result.insights[0]?.action, "確殺せずに切る");
  const kept = recordFromAccount(remote, row({ id: "other", remoteVideoUrl: "https://blob.example/clip" }));
  assert.equal(kept.accountCopy, true);
  assert.equal(kept.pendingAccount, false);
  assert.equal(kept.remoteVideoUrl, "https://blob.example/clip");
  assert.equal(kept.result.insights[0]?.finding, "銃声が残っている");
});

test("an account copy deleted on another device is dropped locally and a device row is not", () => {
  const synced = row({ id: "synced", accountCopy: true });
  const device = row({ id: "device" });
  const plan = planAccountSync([synced, device], []);
  assert.deepEqual(plan.dropLocalIds, ["synced"]);
  assert.deepEqual(plan.upload, []);
});

test("the account payload keeps the coaching and drops video bytes and sync flags", () => {
  const body = accountRecordBody(row({
    id: "one",
    pendingAccount: true,
    accountCopy: true,
    remoteVideoUrl: "https://example.private.blob.vercel-storage.com/clip",
  }));
  assert.ok(body);
  assert.equal(body?.pendingAccount, undefined);
  assert.equal(body?.accountCopy, undefined);
  assert.equal(body?.remoteVideoUrl, undefined);
  assert.equal(body?.result.insights[0]?.title, "ワイド");
  assert.equal(accountRecordBody({ ...row({ id: "bad id" }), id: "bad id" }), null);
});

test("the analyses route uses the session and does not touch the plan or the service role", () => {
  const route = readFileSync(new URL("../app/api/analyses/route.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../supabase/migrations/20261031120000_saved_analyses.sql", import.meta.url), "utf8");
  const webhook = readFileSync(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8");
  assert.match(route, /createSupabaseServer/);
  assert.match(route, /getUser/);
  assert.match(route, /saved_analyses/);
  assert.equal(route.includes("createServiceRoleClient"), false);
  assert.equal(route.includes("stripe"), false);
  assert.equal(route.includes("profiles"), false);
  assert.match(migration, /references public\.profiles/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.equal(migration.includes("status"), false);
  assert.equal(webhook.includes("saved_analyses"), false);
});
