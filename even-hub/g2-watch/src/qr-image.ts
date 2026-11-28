import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function qrPng(text: string) {
  const QRCode = require("qrcode") as {
    toBuffer: (value: string, options: { type: "png"; width: number; margin: number }) => Promise<Buffer>;
  };
  return QRCode.toBuffer(text, { type: "png", width: 640, margin: 2 });
}
