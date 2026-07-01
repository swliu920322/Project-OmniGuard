"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard/theorem", label: "🧮 Theorem" },
  { href: "/dashboard/compare", label: "⚖️ Compare" },
  { href: "/dashboard", label: "🚚 Fleet" },
  { href: "/dashboard/live", label: "🔴 Live" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <nav className="border-b border-slate-900 bg-slate-900/30 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center px-6 h-11 space-x-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xs font-mono font-bold px-3 py-1.5 rounded transition ${
                isActive(item.href)
                  ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                  : "text-slate-500 hover:text-slate-300 border border-transparent"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
