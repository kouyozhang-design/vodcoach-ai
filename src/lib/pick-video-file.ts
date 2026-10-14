"use client";

const CONSTRAINT_ATTRS = ["accept", "required", "pattern", "minlength", "maxlength", "form"] as const;

function stripConstraints(input: HTMLInputElement) {
  for (const name of CONSTRAINT_ATTRS) input.removeAttribute(name);
  input.setCustomValidity("");
}

/** Browser-only file picker. Never render <input type="file"> in React/SSR. */
export function pickVideoFileFromUser(): Promise<File | null> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    stripConstraints(input);
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    Object.assign(input.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
    });

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.disabled = true;
      stripConstraints(input);
      input.remove();
      window.removeEventListener("focus", onFocus);
      resolve(file);
    };

    const onFocus = () => {
      queueMicrotask(() => finish(input.files?.[0] ?? null));
    };

    input.addEventListener("invalid", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    input.addEventListener("change", () => {
      finish(input.files?.[0] ?? null);
    }, { once: true });
    input.addEventListener("cancel", () => finish(null), { once: true });

    document.body.appendChild(input);
    window.addEventListener("focus", onFocus);
    input.click();
  });
}

export function auditControlValidity() {
  if (typeof document === "undefined") return [];
  return [...document.querySelectorAll("input, select, textarea, button")].map((node) => {
    const el = node as HTMLInputElement;
    return {
      tag: el.tagName,
      type: el.getAttribute("type"),
      checkValidity: typeof el.checkValidity === "function" ? el.checkValidity() : true,
      validationMessage: el.validationMessage ?? "",
      patternMismatch: el.validity?.patternMismatch ?? false,
    };
  });
}

export function purgeConstraintValidation() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("form").forEach((form) => {
    form.noValidate = true;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });
  document.querySelectorAll("input, select, textarea, button").forEach((node) => {
    const el = node as HTMLInputElement;
    for (const name of CONSTRAINT_ATTRS) el.removeAttribute(name);
    if (typeof el.setCustomValidity === "function") el.setCustomValidity("");
    if (el instanceof HTMLInputElement && el.type === "file") {
      el.disabled = true;
      el.remove();
    }
  });
}
