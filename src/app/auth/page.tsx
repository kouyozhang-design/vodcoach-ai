"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LanguagePicker } from "@/components/language-picker";
import { uiCopy } from "@/lib/ui-copy";
import { useCoachLanguage } from "@/lib/use-coach-language";
import { writeStoredLanguage } from "@/lib/coach-language";

const providerButton =
  "flex min-h-11 w-full items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-center text-sm font-semibold leading-tight text-zinc-100 hover:bg-white/[0.07]";

function AuthForm() {
  const language = useCoachLanguage();
  const copy = uiCopy(language);
  const params = useSearchParams();
  const callbackError = params.get("error") === "callback";
  const missingConfig = params.get("error") === "missing";
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.status === 503) {
        setNotice(copy.authMissing);
        return;
      }
      if (response.status === 400) {
        setNotice(copy.authInvalid);
        return;
      }
      if (!response.ok) {
        setNotice(copy.authFailed);
        return;
      }
      setNotice(copy.authSent);
    } catch {
      setNotice(copy.authFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-white">
      <p className="text-[15px] font-bold tracking-[-0.03em]">
        VODCoach<span className="text-red-500">.AI</span>
      </p>
      <div className="mt-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">{copy.authTitle}</h1>
        <LanguagePicker
          language={language}
          label={copy.languageLabel}
          onChange={(next) => {
            writeStoredLanguage(next);
            window.dispatchEvent(new Event("vodcoach-language"));
          }}
        />
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{copy.authBody}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <form method="post" action="/api/auth/oauth">
          <input type="hidden" name="provider" value="google" />
          <button type="submit" className={providerButton}>
            {copy.authGoogle}
          </button>
        </form>
        <form method="post" action="/api/auth/oauth">
          <input type="hidden" name="provider" value="apple" />
          <button type="submit" className={providerButton}>
            {copy.authApple}
          </button>
        </form>
      </div>
      <p className="mt-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">
        <span className="h-px flex-1 bg-white/[0.08]" />
        {copy.authOr}
        <span className="h-px flex-1 bg-white/[0.08]" />
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <label className="block space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">{copy.authEmail}</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 text-sm text-zinc-200 outline-none focus:border-red-500/60"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
        >
          {pending ? copy.authSending : copy.authSubmit}
        </button>
      </form>
      {callbackError ? <p className="mt-4 text-sm text-amber-200/90">{copy.authCallback}</p> : null}
      {missingConfig ? (
        <p className="mt-4 text-sm text-zinc-300" role="status">
          {copy.authMissing}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 text-sm text-zinc-300" role="status">
          {notice}
        </p>
      ) : null}
      <Link href="/" className="mt-8 text-sm text-zinc-500 hover:text-white">
        {copy.authBack}
      </Link>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}
