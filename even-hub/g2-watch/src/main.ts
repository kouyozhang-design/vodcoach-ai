import {
  CreateStartUpPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { templeEventType } from "./temple";

const CONTAINER_ID = 1;
const CONTAINER_NAME = "main";

const params = new URLSearchParams(window.location.search);
const code = (params.get("code") || "").trim().toUpperCase();
const api = (params.get("api") || "").trim().replace(/\/$/, "");

const bridge = await waitForEvenAppBridge();

async function paint(content: string, textColor?: number) {
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: CONTAINER_ID,
      containerName: CONTAINER_NAME,
      content,
      textColor,
    }),
  );
}

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        xPosition: 0,
        yPosition: 0,
        width: 576,
        height: 288,
        borderWidth: 0,
        borderColor: 5,
        paddingLength: 4,
        containerID: CONTAINER_ID,
        containerName: CONTAINER_NAME,
        content: code && api ? "Watch 8\n接続中" : "Watch 8\nコードなし\n\nPCの開発ツールに出た\nURLをQRで開く",
        isEventCapture: 1,
      }),
    ],
  }),
);

if (created !== StartUpPageCreateResult.success) {
  console.error("createStartUpPageContainer failed", created);
}

async function postTemple(eventType: number) {
  await fetch(`${api}/api/glasses/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "gesture", code, source: "glasses", eventType }),
  });
}

bridge.onEvenHubEvent((event: EvenHubEvent) => {
  if (!code || !api) return;
  const eventType = templeEventType(event);
  if (eventType === null) return;
  void postTemple(eventType);
});

let revision = -1;
let polling = false;

async function poll() {
  if (!code || !api || polling) return;
  polling = true;
  try {
    const response = await fetch(
      `${api}/api/glasses/session?code=${encodeURIComponent(code)}&role=glasses`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      await paint("Watch 8\nAPIに届かない");
      return;
    }
    const view = (await response.json()) as { revision?: number; canvas?: string; textColor?: number };
    if (typeof view.revision !== "number" || view.revision === revision || typeof view.canvas !== "string") return;
    revision = view.revision;
    await paint(view.canvas, view.textColor);
  } catch {
    await paint("Watch 8\nAPIに届かない");
  } finally {
    polling = false;
  }
}

if (code && api) {
  void poll();
  window.setInterval(() => void poll(), 800);
}
