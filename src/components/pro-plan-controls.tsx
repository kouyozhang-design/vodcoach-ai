"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { uiCopy } from "@/lib/ui-copy";
import { readBillingStatus, requestStripeCheckout } from "@/lib/billing/checkout-client";
import { isStripeRedirect } from "@/lib/billing/redirect";
import { noticeForCheckoutQuery, type PublicBillingState } from "@/lib/billing/events";
import type { CoachLanguage } from "@/lib/coach-language";

const signedOut: PublicBillingState = {
  configured: false,
  signedIn: false,
  status: null,
  canManage: false,
  email: null,
};

function planLabels(language: CoachLanguage) {
  const copy = uiCopy(language);
  return {
    becomePro: copy.becomePro,
    manage: copy.managePlan,
    notConfigured: copy.billingNotConfigured,
    checkoutFailed: copy.checkoutFailed,
    portalFailed: copy.portalFailed,
    noAccount: copy.noAccount,
    returned: copy.checkoutReturned,
    canceled: copy.checkoutCanceled,
    working: copy.billingWorking,
  };
}

function ProButtonFallback({ language }: { language: CoachLanguage }) {
  const copy = planLabels(language);
  return (
    <button
      type="button"
      disabled
      className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-60"
    >
      {copy.becomePro}
    </button>
  );
}

function ProPlanControlsInner({
  language,
  onBecomePro,
}: {
  language: CoachLanguage;
  onBecomePro?: () => void;
}) {
  const copy = planLabels(language);
  const router = useRouter();
  const checkout = noticeForCheckoutQuery(useSearchParams().get("checkout"));
  const [state, setState] = useState<PublicBillingState>(signedOut);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const checkoutMessage = checkout === "returned" ? copy.returned : checkout === "canceled" ? copy.canceled : null;
  const notice = actionNotice ?? checkoutMessage;

  useEffect(() => {
    let cancelled = false;
    void readBillingStatus()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState(signedOut);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (checkout !== "returned") return;
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      void readBillingStatus()
        .then((next) => setState(next))
        .catch(() => undefined);
      if (ticks >= 8) window.clearInterval(timer);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [checkout]);

  async function openCheckout() {
    if (!state.signedIn) {
      router.push("/auth");
      return;
    }
    setPending(true);
    setActionNotice(null);
    try {
      const result = await requestStripeCheckout(language);
      if (result.kind === "auth") {
        router.push("/auth");
        return;
      }
      if (result.kind === "not_configured") {
        setActionNotice(copy.notConfigured);
        return;
      }
      if (result.kind === "no_account") {
        setActionNotice(copy.noAccount);
        return;
      }
      if (result.kind !== "url") {
        setActionNotice(copy.checkoutFailed);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setActionNotice(copy.checkoutFailed);
    } finally {
      setPending(false);
    }
  }

  async function openPortal() {
    if (!state.signedIn) {
      router.push("/auth");
      return;
    }
    setPending(true);
    setActionNotice(null);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const body = (await response.json().catch(() => null)) as { url?: unknown; error?: unknown } | null;
      if (response.status === 401) {
        router.push("/auth");
        return;
      }
      if (response.status === 503 || body?.error === "billing_not_configured") {
        setActionNotice(copy.notConfigured);
        return;
      }
      if (body?.error === "no_billing_account") {
        setActionNotice(copy.noAccount);
        return;
      }
      if (!response.ok || typeof body?.url !== "string" || !isStripeRedirect(body.url, "portal")) {
        setActionNotice(copy.portalFailed);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setActionNotice(copy.portalFailed);
    } finally {
      setPending(false);
    }
  }

  const showPro = state.status !== "pro";
  const showManage = state.signedIn;

  return (
    <div className="contents">
      <div className="flex items-center gap-2">
        {state.status === "pro" ? (
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-200">
            Pro
          </span>
        ) : null}
        {state.email ? (
          <span className="hidden max-w-32 truncate text-[10px] text-zinc-500 lg:inline">{state.email}</span>
        ) : null}
        {showPro ? (
          <a
            href="#pricing"
            onClick={(event) => {
              event.preventDefault();
              if (onBecomePro) {
                onBecomePro();
                return;
              }
              if (!loaded || pending) return;
              void openCheckout();
            }}
            className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-red-500"
          >
            {pending ? copy.working : copy.becomePro}
          </a>
        ) : null}
        {showManage ? (
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={!loaded || pending}
            className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-zinc-300 hover:text-white disabled:opacity-60"
          >
            {copy.manage}
          </button>
        ) : null}
      </div>
      {notice ? (
        <p className="basis-full text-right text-[11px] leading-5 text-zinc-400" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

export function ProPlanControls({
  language,
  onBecomePro,
}: {
  language: CoachLanguage;
  onBecomePro?: () => void;
}) {
  return (
    <Suspense fallback={<ProButtonFallback language={language} />}>
      <ProPlanControlsInner language={language} onBecomePro={onBecomePro} />
    </Suspense>
  );
}
