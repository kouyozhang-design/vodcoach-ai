import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CTA_MAX_CHARS,
  TITLE_MAX_CHARS,
  TSUKKOMI_MAX_CHARS,
  charLength,
  defaultCta,
  formatViralHookCopy,
  formatViralScriptCopy,
  parseViralScript,
} from "./viral-script.ts";

test("parseViralScript keeps an Apex callout and drops VALORANT", () => {
  const script = parseViralScript(
    {
      video_title: "オフアングル捨てて正面",
      ai_tsukkomi: "00:12、オフアングルあるのに正面ピーク。権利は敵。",
      cta_text: "自分のVODもVODCoach.AIで刺せ → vodcoach-ai.vercel.app",
    },
    "apex-legends",
    "ja",
  );
  assert.equal(script?.video_title, "オフアングル捨てて正面");
  assert.ok(script && charLength(script.ai_tsukkomi) <= TSUKKOMI_MAX_CHARS);
  assert.match(script?.cta_text ?? "", /vodcoach-ai\.vercel\.app/);

  assert.equal(
    parseViralScript(
      { video_title: "You peeked", ai_tsukkomi: "Heaven was open.", cta_text: "Come" },
      "valorant",
      "en",
    ),
    undefined,
  );
});

test("parseViralScript omits a callout the fields do not support and clamps the line", () => {
  assert.equal(
    parseViralScript({ video_title: "  ", ai_tsukkomi: "リロードが遅い", cta_text: "x" }, "apex-legends", "ja"),
    undefined,
  );
  assert.equal(parseViralScript(null, "apex-legends", "ja"), undefined);

  const long = "あ".repeat(TSUKKOMI_MAX_CHARS + 25);
  const script = parseViralScript(
    { video_title: "リロード、撃ち合いの途中", ai_tsukkomi: long, cta_text: "" },
    "apex-legends",
    "ja",
  );
  assert.equal(charLength(script?.ai_tsukkomi ?? ""), TSUKKOMI_MAX_CHARS);
  assert.equal(script?.cta_text, defaultCta("ja"));
  assert.ok(charLength(defaultCta("ja")) <= CTA_MAX_CHARS);
  assert.ok(charLength(defaultCta("en")) <= CTA_MAX_CHARS);
  for (const language of ["pt", "ko", "de", "fr", "es", "pl", "zh-TW", "tr", "it", "id"] as const) {
    assert.ok(charLength(defaultCta(language)) <= CTA_MAX_CHARS, language);
  }
  assert.ok(charLength("あ".repeat(TITLE_MAX_CHARS + 5)) > TITLE_MAX_CHARS);
});

test("formatViralScriptCopy is the three lines", () => {
  const text = formatViralScriptCopy({
    video_title: "岩を離れて2射線",
    ai_tsukkomi: "00:04、岩を離れて左右を同時に開けてる。",
    cta_text: defaultCta("en"),
  });
  assert.equal(
    text,
    `岩を離れて2射線\n00:04、岩を離れて左右を同時に開けてる。\n${defaultCta("en")}`,
  );
});

test("formatViralHookCopy is the title and the roast, without the CTA", () => {
  const text = formatViralHookCopy({
    video_title: "岩を離れて2射線",
    ai_tsukkomi: "00:04、岩を離れて左右を同時に開けてる。",
    cta_text: defaultCta("ja"),
  });
  assert.equal(text, "岩を離れて2射線\n00:04、岩を離れて左右を同時に開けてる。");
  assert.equal(text.includes(defaultCta("ja")), false);
  const block = readFileSync(new URL("../../components/viral-script-block.tsx", import.meta.url), "utf8");
  assert.match(block, /from "@\/components\/ui\/button"/);
  assert.match(block, /formatViralHookCopy/);
  assert.match(block, /<Button/);
  assert.equal(block.includes("formatViralScriptCopy"), false);
});
