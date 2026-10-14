import type { NextConfig } from "next";

const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, proxy-revalidate",
  },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig: NextConfig = {
  // Do not set `output: "export"`. POST /api/coach needs a Node server on Vercel.
  async headers() {
    return [
      { source: "/", headers: noStoreHeaders },
      { source: "/:path*", headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
