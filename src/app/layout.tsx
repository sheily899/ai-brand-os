import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Brand OS",
  description: "AI 原生品牌决策工作台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
