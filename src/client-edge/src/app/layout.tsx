import type { Metadata } from "next";
import "./globals.css";
// 🟩 核心引入：空降数字人全局挂件
import CognitiveAvatarWidget from "@/components/digital-human/CognitiveAvatarWidget";

export const metadata: Metadata = {
  title: "LIU SHENGWEI // Solutions Architect Portfolio",
  description: "Enterprise RAG & Agentic Workflow Sandbox",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-950">
      <body className="antialiased min-h-full relative">

        {/* 1. 动态页面视窗：children 随路由高频刷新重绘 */}
        {children}

        {/* 2. 🏁 【顶级合拢】：数字人横亘在 children 外层布局腹地，跨页绝不断电 */}
        <CognitiveAvatarWidget />

      </body>
    </html>
  );
}