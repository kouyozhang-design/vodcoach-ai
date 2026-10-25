import { shareChrome, type CoachLanguage } from "@/lib/coach-language";
import { adviceFromResult, buildShareTweetUrl, type ShareAdviceSource } from "@/lib/share-tweet";

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

export function ShareTweetButton({
  result,
  language = "ja",
}: {
  result: ShareAdviceSource;
  language?: CoachLanguage;
}) {
  const chrome = shareChrome(language);
  const href = buildShareTweetUrl(adviceFromResult(result));

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={chrome.hint}
      className="group inline-flex items-center gap-2.5 rounded-full border border-white/[0.1] bg-gradient-to-r from-white/[0.07] via-white/[0.03] to-red-600/15 px-3.5 py-2 text-[12px] font-semibold text-white shadow-[0_0_24px_-12px_rgba(220,38,38,0.7)] transition hover:border-white/25 hover:from-white/[0.12] hover:to-red-500/25 hover:shadow-[0_0_28px_-10px_rgba(220,38,38,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-black text-white ring-1 ring-white/15 transition group-hover:ring-white/35">
        <XMark className="size-3.5" />
      </span>
      <span>{chrome.label}</span>
    </a>
  );
}
