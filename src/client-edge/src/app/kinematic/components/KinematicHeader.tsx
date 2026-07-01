"use client";

import React from "react";

type Mode = "cloud" | "edge";

interface KinematicHeaderProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onReset: () => void;
}

export default function KinematicHeader({ mode, onModeChange, onReset }: KinematicHeaderProps) {
  return (
    <header className="border-b border-slate-900 bg-slate-900/30 backdrop-blur-md py-5 px-6 md:px-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
          <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            Kinematic Theorem Sandbox
          </h1>
        </div>
        <p className="text-xs md:text-sm text-slate-500 font-mono max-w-2xl">
          Quantifies why cloud-only control loops cannot control fast-moving hardware: physical braking distance
          is bounded by end-to-end cloud latency vs. instantaneous edge reaction.
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-900">
          <button
            onClick={() => onModeChange("cloud")}
            className={`text-[10px] uppercase font-mono px-3 py-1.5 rounded transition ${
              mode === "cloud"
                ? "bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 font-bold"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            ☁️ Cloud-Only
          </button>
          <button
            onClick={() => onModeChange("edge")}
            className={`text-[10px] uppercase font-mono px-3 py-1.5 rounded transition ${
              mode === "edge"
                ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            ⚡ Edge Fallback
          </button>
        </div>

        <button
          onClick={onReset}
          className="px-4 py-1.5 rounded-lg font-bold text-[10px] tracking-wide uppercase bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition"
        >
          ↺ Reset
        </button>
      </div>
    </header>
  );
}
