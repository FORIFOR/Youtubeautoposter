import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growth Studio | 日本語動画の改善ワークスペース",
  description: "投稿の結果から、次の一本へ。YouTube動画の計測・比較・制作指示を管理。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
