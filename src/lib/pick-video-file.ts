"use client";

/** Browser-only file picker. Never render <input type="file"> in React/SSR. */
export function pickVideoFileFromUser(): Promise<File | null> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.removeAttribute("accept");
    input.removeAttribute("required");
    input.removeAttribute("pattern");
    input.removeAttribute("form");
    input.removeAttribute("class");
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    Object.assign(input.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "0",
      height: "0",
      opacity: "0",
    });

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      window.removeEventListener("focus", onFocus);
      resolve(file);
    };

    const onFocus = () => {
      window.setTimeout(() => finish(input.files?.[0] ?? null), 300);
    };

    input.addEventListener("change", () => {
      finish(input.files?.[0] ?? null);
    });

    document.body.appendChild(input);
    window.addEventListener("focus", onFocus);
    input.click();
  });
}
