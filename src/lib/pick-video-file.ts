"use client";

type OpenFilePicker = (options?: { multiple?: boolean }) => Promise<Array<{ getFile: () => Promise<File> }>>;

/** WebKit/Safari — never create <input type="file"> here; it treats accept as a pattern. */
export function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const vendor = navigator.vendor ?? "";
  if (/Apple Computer/i.test(vendor)) return true;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Firefox|FxiOS|Android/i.test(ua);
}

export function canUseOpenFilePicker() {
  return typeof window !== "undefined"
    && typeof (window as Window & { showOpenFilePicker?: OpenFilePicker }).showOpenFilePicker === "function";
}

export function removeDocumentFileInputs() {
  if (typeof document === "undefined") return;
  document.querySelectorAll('input[type="file"]').forEach((node) => {
    const input = node as HTMLInputElement;
    input.disabled = true;
    input.removeAttribute("accept");
    input.removeAttribute("required");
    input.removeAttribute("pattern");
    input.removeAttribute("form");
    input.remove();
  });
}

export async function pickVideoFileFromUser(): Promise<File | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  removeDocumentFileInputs();

  if (canUseOpenFilePicker()) {
    try {
      const picker = (window as unknown as { showOpenFilePicker: OpenFilePicker }).showOpenFilePicker;
      const handles = await picker.call(window, { multiple: false });
      const file = await handles[0]?.getFile();
      return file ?? null;
    } catch (error) {
      if (isUserCancel(error) || isSafariBrowser()) return null;
    }
  }

  if (isSafariBrowser()) return null;
  return pickWithDetachedInput();
}

function isUserCancel(error: unknown) {
  return error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError");
}

function pickWithDetachedInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.removeAttribute("accept");
    input.removeAttribute("required");
    input.removeAttribute("pattern");
    input.removeAttribute("form");
    input.removeAttribute("class");

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.disabled = true;
      input.value = "";
      input.remove();
      resolve(file);
    };

    input.addEventListener("change", () => {
      finish(input.files?.[0] ?? null);
    });
    input.addEventListener("cancel", () => finish(null));
    input.click();
  });
}
