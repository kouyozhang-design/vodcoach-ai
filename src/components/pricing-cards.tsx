"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { readBillingStatus, requestStripeCheckout } from "@/lib/billing/checkout-client";
import type { CoachLanguage } from "@/lib/coach-language";
import { uiCopy } from "@/lib/ui-copy";

export function PricingCards({ language }: { language: CoachLanguage }) {
  const copy = uiCopy(language);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function upgrade() {
    setPending(true);
    setNotice(null);
    try {
      const state = await readBillingStatus().catch(() => null);
      if (!state?.signedIn) {
        router.push("/auth");
        return;
      }
      const result = await requestStripeCheckout(language);
      if (result.kind === "auth") {
        router.push("/auth");
        return;
      }
      if (result.kind === "not_configured") {
        setNotice(copy.billingNotConfigured);
        return;
      }
      if (result.kind === "no_account") {
        setNotice(copy.noAccount);
        return;
      }
      if (result.kind !== "url") {
        setNotice(copy.checkoutFailed);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setNotice(copy.checkoutFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div id="pricing" className="mt-4 scroll-mt-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="flex flex-col justify-between rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{copy.planFreeName}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{copy.planFreeDetail}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled
            className="mt-4 h-auto w-full whitespace-normal border-white/15 bg-transparent py-2 text-zinc-300"
          >
            {copy.planFreeCurrent}
          </Button>
        </article>
        <article className="flex flex-col justify-between rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-600/20 via-zinc-950 to-zinc-950 p-4 shadow-[0_16px_40px_rgba(220,38,38,0.16)]">
          <div>
            <div className="flex items-end justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-300">{copy.planProName}</p>
              <p className="text-lg font-semibold tracking-tight text-white">{copy.planProPrice}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-100">{copy.planProDetail}</p>
          </div>
          <Button
            type="button"
            onClick={() => void upgrade()}
            disabled={pending}
            className="mt-4 h-auto w-full whitespace-normal bg-red-600 py-2 text-white hover:bg-red-500"
          >
            {pending ? copy.billingWorking : copy.planProUpgrade}
          </Button>
        </article>
      </div>
      {notice ? (
        <p className="mt-2 text-[11px] leading-5 text-zinc-400" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
