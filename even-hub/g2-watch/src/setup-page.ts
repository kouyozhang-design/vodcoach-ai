import type { Household } from "./household.ts";
import { glassesPageUrl, relayOrigin } from "./household.ts";

export function renderSetupPage(home: Household, qrSvg: string) {
  const api = relayOrigin(home.host);
  const page = glassesPageUrl(home);
  const payload = JSON.stringify({ code: home.code, api });
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Watch で G2</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: ui-sans-serif, sans-serif; background: #111; color: #f4f4f4; }
    main { max-width: 28rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
    h1 { font-size: 1.25rem; font-weight: 650; margin: 0 0 0.25rem; }
    p { line-height: 1.5; color: #c8c8c8; }
    .code { font-size: 4rem; letter-spacing: 0.2rem; font-weight: 700; margin: 0.5rem 0; }
    .card { background: #1c1c1c; border-radius: 1rem; padding: 1rem; margin: 1rem 0; }
    .qr { background: #fff; border-radius: 0.75rem; padding: 0.75rem; }
    .qr svg { display: block; width: 100%; height: auto; }
    pre { white-space: pre-wrap; font-size: 1rem; margin: 0; min-height: 8rem; }
    button { font: inherit; border: 0; border-radius: 999px; padding: 0.7rem 1rem; background: #2e2e2e; color: inherit; }
    button.primary { background: #f4f4f4; color: #111; }
    .row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    code { color: #fff; }
  </style>
</head>
<body>
  <main>
    <h1>Watch で G2</h1>
    <p>この画面を開いたままにしてください。Mac はスリープさせません。</p>
    <div class="card">
      <div>メガネと Watch のコード</div>
      <div class="code">${escapeHtml(home.code)}</div>
      <div>API <code>${escapeHtml(api)}</code></div>
    </div>
    <div class="card">
      <p>スマホの Even アプリで、Even Hub の QR からこれを読みます。</p>
      <div class="qr">${qrSvg}</div>
    </div>
    <div class="card">
      <div>いまメガネに出ている画面</div>
      <pre id="canvas">読み込み中</pre>
    </div>
    <div class="row">
      <button class="primary" data-gesture="click">タップ</button>
      <button data-gesture="double-click">ダブルタップ</button>
      <button data-gesture="scroll-up">クラウン上</button>
      <button data-gesture="scroll-down">クラウン下</button>
      <button data-gesture="brighter">明るく</button>
      <button data-gesture="dimmer">暗く</button>
      <button data-gesture="long-press">コードに戻る</button>
    </div>
    <p>Apple Watch は初回だけ、Xcode で <code>even-hub/g2-watch/watch/WristRemote.xcodeproj</code> を実行します。コードと API は入っています。</p>
  </main>
  <script>
    const home = ${payload};
    const canvas = document.querySelector("#canvas");
    async function refresh() {
      const response = await fetch("/api/session?code=" + encodeURIComponent(home.code) + "&role=watch", { cache: "no-store" });
      if (!response.ok) { canvas.textContent = "届かない"; return; }
      const view = await response.json();
      canvas.textContent = view.canvas || "";
    }
    document.querySelectorAll("[data-gesture]").forEach((button) => {
      button.addEventListener("click", async () => {
        await fetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "gesture", gesture: button.dataset.gesture, code: home.code, source: "watch" }),
        });
        await refresh();
      });
    });
    refresh();
    setInterval(refresh, 1000);
  </script>
  <p hidden>${escapeHtml(page)}</p>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
