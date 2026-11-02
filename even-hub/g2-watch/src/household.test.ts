import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chooseLanIPv4,
  glassesPageUrl,
  loadHousehold,
  patchAppJson,
  readHousehold,
  relayOrigin,
  relayOriginSource,
  watchConfigSource,
} from "./household.ts";
import { renderSetupPage } from "./setup-page.ts";

test("the Mac address on Wi-Fi is preferred over internal addresses", () => {
  const chosen = chooseLanIPv4([
    { name: "lo", address: "127.0.0.1", family: "IPv4", internal: true },
    { name: "docker0", address: "172.18.0.1", family: "IPv4", internal: false },
    { name: "en0", address: "192.168.1.8", family: "IPv4", internal: false },
  ]);
  assert.equal(chosen, "192.168.1.8");
  assert.equal(
    chooseLanIPv4([{ name: "eth0", address: "172.18.0.4", family: "IPv4", internal: false }]),
    "172.18.0.4",
  );
  assert.equal(chooseLanIPv4([]), "127.0.0.1");
});

test("the same pair code is kept and the phone is allowed to call it", () => {
  const saved = JSON.stringify({ code: "k7m2", host: "10.0.0.2" });
  assert.deepEqual(loadHousehold(saved), { code: "K7M2", host: "10.0.0.2" });
  const home = readHousehold(saved, "192.168.1.8");
  assert.deepEqual(home, { code: "K7M2", host: "192.168.1.8" });
  const fresh = readHousehold("nope", "10.0.0.8");
  assert.match(fresh.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  const origin = relayOrigin(home.host);
  const patched = patchAppJson(
    JSON.stringify({ permissions: [{ name: "network", whitelist: ["http://127.0.0.1:8787"] }] }),
    origin,
  );
  const again = patchAppJson(patched, origin);
  const whitelist = JSON.parse(again).permissions[0].whitelist;
  assert.deepEqual(whitelist, ["http://127.0.0.1:8787", "http://192.168.1.8:8787"]);
  assert.match(relayOriginSource(origin), /RELAY_ORIGIN = "http:\/\/192\.168\.1\.8:8787"/);
  assert.match(watchConfigSource(origin, home.code), /static let code = "K7M2"/);
  assert.match(glassesPageUrl(home), /code=K7M2/);
  const page = renderSetupPage(home, "<svg></svg>");
  assert.match(page, />K7M2</);
  assert.match(page, /192\.168\.1\.8:8787/);
  assert.doesNotMatch(page, /<script>[^]*<svg>/);
});
