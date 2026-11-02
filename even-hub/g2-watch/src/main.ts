import {
  CreateStartUpPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { RELAY_ORIGIN } from "./relay-origin";
import { templeEventType } from "./temple";

const CONTAINER_ID = 1;
const CONTAINER_NAME = "main";

const params = new URLSearchParams(window.location.search);
const api = (params.get("api") || RELAY_ORIGIN).trim().replace(/\/$/, "");

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
        content: "Watch 8\n接続中",
        isEventCapture: 1,
      }),
    ],
  }),
);

if (created !== StartUpPageCreateResult.success) {
  console.error("createStartUpPageContainer failed", created);
}

let code = "";
let revision = -1;
let polling = false;

async function post(body: Record<string, unknown>) {
  await fetch(`${api}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function openSession() {
  const response = await fetch(`${api}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "open" }),
  });
  if (!response.ok) throw new Error("open");
  const view = (await response.json()) as { code?: string; canvas?: string; textColor?: number; revision?: number };
  if (!view.code || !view.canvas) throw new Error("open");
  code = view.code;
  revision = typeof view.revision === "number" ? view.revision : 0;
  await paint(view.canvas, view.textColor);
}

bridge.onEvenHubEvent((event: EvenHubEvent) => {
  if (!code) return;
  const eventType = templeEventType(event);
  if (eventType === null) return;
  void post({ action: "gesture", code, source: "glasses", eventType });
});

async function poll() {
  if (!code || polling) return;
  polling = true;
  try {
    const response = await fetch(
      `${api}/api/session?code=${encodeURIComponent(code)}&role=glasses`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      await paint("Watch 8\nリレーに届かない");
      return;
    }
    const view = (await response.json()) as { revision?: number; canvas?: string; textColor?: number };
    if (typeof view.revision !== "number" || view.revision === revision || typeof view.canvas !== "string") return;
    revision = view.revision;
    await paint(view.canvas, view.textColor);
  } catch {
    await paint("Watch 8\nリレーに届かない");
  } finally {
    polling = false;
  }
}

try {
  await openSession();
  window.setInterval(() => void poll(), 800);
} catch {
  await paint("Watch 8\nリレーを起動\nport 8787");
}
