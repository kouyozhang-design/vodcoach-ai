"use client";

/**
 * iOS shows camera, photo library, and Files when accept includes both.
 * Do not add a capture attribute — that skips the library and Files.
 */
export const COACH_FILE_ACCEPT = "image/*,video/*";

/** Marks the one React-rendered file input so cleanup never removes it. */
export const STATIC_FILE_INPUT_ATTR = "data-vodcoach-file-input";

/** WebKit/Safari — file inputs must stay the static React node. Script-created ones surface patternMismatch. */
export function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iP(hone|ad|od)/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && /Mobile/i.test(ua)) return true;
  if (/Apple Computer/i.test(navigator.vendor ?? "")) return true;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Firefox|FxiOS|Android/i.test(ua);
}

export function fileFromDataTransfer(transfer: DataTransfer | null): File | null {
  const list = transfer?.files;
  const raw = list && list.length > 0 ? list.item(0) : null;
  // Keep the original File. Copying its bytes stalls Safari upload at 0%.
  return raw;
}

export function isStaticCoachFileInput(node: Element) {
  return node instanceof HTMLInputElement && node.getAttribute(STATIC_FILE_INPUT_ATTR) === "static";
}

export function clearFileInputValue(input: HTMLInputElement) {
  try {
    input.value = "";
  } catch {
    /* Safari may block value writes on file inputs. */
  }
}

/** Drop script-created file inputs only. The React input stays in the tree. */
export function removeDocumentFileInputs() {
  if (typeof document === "undefined") return;
  document.querySelectorAll('input[type="file"]').forEach((node) => {
    if (!(node instanceof HTMLInputElement) || isStaticCoachFileInput(node)) return;
    node.disabled = true;
    node.removeAttribute("accept");
    node.removeAttribute("required");
    node.removeAttribute("pattern");
    node.removeAttribute("form");
    node.removeAttribute("capture");
    clearFileInputValue(node);
    node.remove();
  });
}

export function silenceNativeValidation(event?: Event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
  removeDocumentFileInputs();
}

export function installSafariValidityPatch() {
  if (typeof window === "undefined" || !isSafariBrowser()) return () => undefined;
  const proto = HTMLInputElement.prototype;
  const report = proto.reportValidity;
  const check = proto.checkValidity;
  proto.reportValidity = function reportValidityPatched() {
    if (this.type === "file") return true;
    return report.call(this);
  };
  proto.checkValidity = function checkValidityPatched() {
    if (this.type === "file") {
      this.setCustomValidity("");
      return true;
    }
    return check.call(this);
  };
  return () => {
    proto.reportValidity = report;
    proto.checkValidity = check;
  };
}
