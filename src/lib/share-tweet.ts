/** X / Twitter compose intent. Hashtag stays in `text` — `hashtags=` drops Japanese tags. */

export const SHARE_APP_URL = "https://vodcoach-ai.vercel.app";
export const SHARE_HASHTAG = "#ApexAIコーチ";
export const TWEET_INTENT_URL = "https://x.com/intent/tweet";
export const TWEET_MAX_CHARS = 280;

export type ShareAdviceSource = {
  headline?: string;
  summary?: string;
  insights?: Array<{ title?: string; finding?: string; action?: string }>;
};

export function tweetCharCount(value: string) {
  return [...value].length;
}

export function truncateTweetSummary(summary: string, reserved: number) {
  const max = TWEET_MAX_CHARS - reserved;
  const chars = [...summary.replace(/\s+/g, " ").trim()];
  if (max <= 0) return "";
  if (chars.length <= max) return chars.join("");
  if (max === 1) return "…";
  return `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

export function adviceFromResult(result: ShareAdviceSource) {
  const first = result.insights?.find((insight) => insight.title?.trim() || insight.action?.trim() || insight.finding?.trim());
  if (first) {
    const title = first.title?.trim() ?? "";
    const detail = (first.action || first.finding || "").trim();
    if (title && detail) return `${title}。${detail}`;
    return title || detail;
  }
  return (result.summary || result.headline || "").trim();
}

export function buildShareTweetText(summary: string) {
  const suffix = `\n\n${SHARE_HASHTAG}\n${SHARE_APP_URL}`;
  const body = truncateTweetSummary(summary, tweetCharCount(suffix));
  return `${body}${suffix}`;
}

export function buildShareTweetUrl(summary: string) {
  const text = buildShareTweetText(summary);
  return `${TWEET_INTENT_URL}?text=${encodeURIComponent(text)}`;
}
