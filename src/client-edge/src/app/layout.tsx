import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { I18nProvider } from "@/components/I18nProvider";

export const metadata: Metadata = {
  title: "OmniGuard — Cloud-Edge AGV Safety Research",
  description: "Simulated AGV dashboard, three-stage agent pipeline, and benchmark evidence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-950">
      <body className="antialiased min-h-full relative overflow-hidden">
        <I18nProvider>
          <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
            {/* 1. 📂 侧边折叠导航栏 */}
            <Sidebar />

            {/* 2. 🖥️ 动态主视图视窗 */}
            <div className="flex-1 min-w-0 overflow-y-auto relative">
              {children}
            </div>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
