import assert from "node:assert/strict";
import { test } from "node:test";
import { isWristRemoteProcess } from "./ports.ts";

test("only this remote is stopped when its port is still open", () => {
  assert.equal(isWristRemoteProcess("node --experimental-strip-types src/relay.ts"), true);
  assert.equal(isWristRemoteProcess("/Users/choukouyo/vodcoach-ai/even-hub/g2-watch/node_modules/vite/bin/vite.js"), true);
  assert.equal(isWristRemoteProcess("node src/start.ts"), true);
  assert.equal(isWristRemoteProcess("/usr/sbin/httpd"), false);
});
