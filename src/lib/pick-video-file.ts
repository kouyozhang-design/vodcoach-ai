"use client";

/** Never render <input type="file"> in React/SSR. Prefer the File System Access picker. */
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

type OpenFilePicker = (options?: { multiple?: boolean }) => Promise<Array<{ getFile: () => Promise<File> }>>;

export async function pickVideoFileFromUser(): Promise<File | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  removeDocumentFileInputs();

  const picker = (window as Window & { showOpenFilePicker?: OpenFilePicker }).showOpenFilePicker;
  if (typeof picker === "function") {
    try {
      const handles = await picker.call(window, { multiple: false });
      const file = await handles[0]?.getFile();
      return file ?? null;
    } catch (error) {
      if (isUserCancel(error)) return null;
    }
  }

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
