"use client";

type OpenFilePicker = (options?: { multiple?: boolean }) => Promise<Array<{ getFile: () => Promise<File> }>>;

/** WebKit/Safari — never create <input type="file">; WebKit reports accept as patternMismatch. */
export function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iP(hone|ad|od)/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && /Mobile/i.test(ua)) return true;
  if (/Apple Computer/i.test(navigator.vendor ?? "")) return true;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Firefox|FxiOS|Android/i.test(ua);
}

export function canUseOpenFilePicker() {
  return typeof window !== "undefined"
    && typeof (window as unknown as { showOpenFilePicker?: OpenFilePicker }).showOpenFilePicker === "function";
}

export function fileFromDataTransfer(transfer: DataTransfer | null): File | null {
  const list = transfer?.files;
  const raw = list && list.length > 0 ? list.item(0) : null;
  if (!raw) return null;
  return cloneCoachFile(raw);
}

export function cloneCoachFile(file: File) {
  return new File([file], file.name, { type: file.type, lastModified: file.lastModified });
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
    try {
      input.value = "";
    } catch {
      /* Safari may block value writes on file inputs. */
    }
    input.remove();
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

export async function pickVideoFileFromUser(): Promise<File | null> {
  if (typeof window === "undefined") return null;
  if (isSafariBrowser()) return null;
  removeDocumentFileInputs();
  if (!canUseOpenFilePicker()) return null;

  try {
    const picker = (window as unknown as { showOpenFilePicker: OpenFilePicker }).showOpenFilePicker;
    const handles = await picker.call(window, { multiple: false });
    const file = await handles[0]?.getFile();
    return file ? cloneCoachFile(file) : null;
  } catch (error) {
    if (error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError")) {
      return null;
    }
    return null;
  }
}
