import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VODCoach.AI — 試合一本とライブコーチ",
  description:
    "Apex Legends と VALORANT のクリップや試合一本を解析し、改善点ごとにカードを出します。長い試合は種類タブと試合全体の回転で読みます。PCライブは画面共有で、戦闘後と膠着だけ声で話します。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#080809]">{children}</body>
    </html>
  );
}
