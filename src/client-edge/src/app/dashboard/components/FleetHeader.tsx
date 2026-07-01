"use client";

import React from "react";

interface FleetHeaderProps {
  fleetStatus: "idle" | "running" | "all_safe" | "any_crashed" | "mixed" | "paused";
}

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
  idle: { label: "Idle", dot: "bg-slate-500", text: "text-slate-500" },
  running: { label: "Running", dot: "bg-cyan-500 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]", text: "text-cyan-400" },
  all_safe: { label: "All Safe", dot: "bg-emerald-500", text: "text-emerald-400" },
  any_crashed: { label: "Collision", dot: "bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]", text: "text-red-400" },
  mixed: { label: "Mixed", dot: "bg-amber-500", text: "text-amber-400" },
  paused: { label: "Paused", dot: "bg-amber-500", text: "text-amber-400" },
};

export default function FleetHeader({ fleetStatus }: FleetHeaderProps) {
  const cfg = statusConfig[fleetStatus] ?? statusConfig.idle;

  return (
    <header className="border-b border-slate-900 bg-slate-900/30 backdrop-blur-md sticky top-0 z-50 py-4 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
          Fleet Kinematic Control Plane
        </h1>
        <span className={`text-xs uppercase font-mono font-bold px-2 py-0.5 rounded border ${cfg.text} border-current/30 bg-current/5`}>
          {cfg.label}
        </span>
      </div>
      <div className="flex items-center space-x-3" />
    </header>
  );
}
