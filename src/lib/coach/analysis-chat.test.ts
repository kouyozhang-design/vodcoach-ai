import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COACHING_BAR } from "./bar.ts";
import {
  analysisChatSystemPrompt,
  analysisJsonForPrompt,
  groundedFallbackReply,
  parseChatRequest,
  type AnalysisChatSubject,
} from "./analysis-chat-prompt.ts";

const subject: AnalysisChatSubject = {
  analysisId: "fight-1",
  game: "apex-legends",
  rank: "Gold",
  character: "Wraith",
  concern: "近距離で2射線を開く",
  headline: "岩のワイド",
  summary: "ノック前に両方の射線を開いた",
  insights: [{
    id: "wide",
    tab: "aim",
    timestamp: "01:12",
    title: "ワイド",
    finding: "岩の右で2射線を同時に見た",
    action: "左の段差に切ってからピークする",
  }],
};

test("the chat prompt keeps the coaching bar and the saved analysis", () => {
  const json = analysisJsonForPrompt(subject);
  const prompt = analysisChatSystemPrompt("ja", json);
  assert.ok(prompt.startsWith(COACHING_BAR));
  assert.match(prompt, /辛口/);
  assert.match(prompt, /水準は下げない/);
  assert.match(json, /左の段差に切ってからピークする/);
  assert.match(prompt, /左の段差に切ってからピークする/);
  assert.equal(json.includes("R-301"), false);
});

test("a missing language stays Japanese, and mock replies use the saved finding", () => {
  const parsed = parseChatRequest({
    analysis: subject,
    messages: [{ role: "user", text: "なぜ切る？" }],
  });
  assert.ok(!("error" in parsed));
  if ("error" in parsed) return;
  assert.equal(parsed.language, "ja");
  assert.match(groundedFallbackReply(parsed.subject), /左の段差に切ってからピークする/);
});

test("chat uses gemini-3.8-flash and does not add a second provider or touch live speech", () => {
  const chat = readFileSync(new URL("./analysis-chat.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../app/api/coach/chat/route.ts", import.meta.url), "utf8");
  const home = readFileSync(new URL("../../components/home-screen.tsx", import.meta.url), "utf8");
  const live = readFileSync(new URL("../../components/live-session.tsx", import.meta.url), "utf8");
  const signOut = readFileSync(new URL("../../app/auth/sign-out/route.ts", import.meta.url), "utf8");
  assert.match(chat, /gemini-3\.8-flash/);
  assert.equal(chat.includes("openai"), false);
  assert.equal(chat.includes("anthropic"), false);
  assert.match(route, /answerAnalysisChat/);
  assert.match(home, /AnalysisChat/);
  assert.match(home, /saveAccountCopy/);
  assert.match(home, /signedIn \? saveAccountCopy/);
  assert.match(home, /setSourceResult\(record\.result\)/);
  assert.equal(live.includes("AnalysisChat"), false);
  assert.equal(live.includes("analysis-chat"), false);
  assert.equal(signOut.includes("saved_analyses"), false);
  assert.equal(signOut.includes("AnalysisChat"), false);
  const saved = readFileSync(new URL("../../components/saved-analyses.tsx", import.meta.url), "utf8");
  assert.match(saved, /aria-expanded/);
  assert.match(saved, /coachingView/);
  assert.match(saved, /InsightBoard/);
});
