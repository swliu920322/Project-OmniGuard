"use client";

import React from "react";
import { TrackId, TrackConfig } from "../config/scenarios";

interface AGVTrackProps {
  label: string;
  positionM: number;
  totalDistanceM: number;
  clearanceM: number;
  status: "idle" | "running" | "crashed" | "safe_stop";
  trackId: TrackId;
  config: TrackConfig;
  liveCloudMs: number;
}

export default function AGVTrack({ label, positionM, totalDistanceM, clearanceM, status, trackId, config, liveCloudMs }: AGVTrackProps) {
  const pct = totalDistanceM > 0 ? positionM / totalDistanceM : 0;
  const clearancePct = clearanceM / totalDistanceM;
  const clearanceStartPct = Math.max(0, 1 - clearancePct);
  const agvLeft = Math.min(pct * 100, 98);

  const statusColor = status === "crashed" ? "bg-red-500" : status === "safe_stop" ? "bg-cyan-500" : status === "running" ? "bg-amber-500" : "bg-slate-600";

  const modeStr = config.edgeLatencyMs !== null ? `${config.edgeLatencyMs}ms edge` : "cloud-only";
  const cloudStr = config.cloudLatencyMs === "computed" ? `${Math.round(liveCloudMs)}ms (computed)` : `${liveCloudMs}ms`;

  // annotation: helps viewers understand each AGV's role
  const archNote = config.cloudLatencyMs === "computed"
    ? "🧠 LLM token latency — tweak in Token Breakdown"
    : config.edgeLatencyMs !== null
    ? "☁️+⚡ Edge guardian overrides slow cloud"
    : "☁️ Cloud detection only — no edge fallback";
  const statusNote = status === "crashed" ? " — 💥 Collided" : "";

  return (
    <div className="border border-slate-900 bg-slate-950/40 rounded-xl p-3 flex flex-col space-y-2">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
          {label}
        </span>
        <span className={`text-xs font-mono font-bold uppercase px-2 py-0.5 rounded border ${statusColor.replace("bg-", "border-").replace("-500", "-500/40")} ${statusColor} ${statusColor.includes("bg-cyan") ? "bg-cyan-950/60 text-cyan-400 border-cyan-500/40" : statusColor.includes("bg-red") ? "bg-red-950/60 text-red-400 border-red-500/40" : statusColor.includes("bg-amber") ? "bg-amber-950/60 text-amber-400 border-amber-500/40" : "bg-slate-950 text-slate-500 border-slate-800"}`}>
          {status === "crashed" ? "CRASHED" : status === "safe_stop" ? "SAFE" : status === "running" && positionM >= totalDistanceM ? "OVERDUE" : status === "running" ? "MOVING" : "IDLE"}
        </span>
      </div>

      {/* Track bar */}
      <div className="relative h-10 bg-slate-950 rounded-lg border border-slate-900 overflow-hidden">
        {/* Clearance zone (red) */}
        <div
          className="absolute top-0 bottom-0 bg-red-950/50 border-l border-red-500/30"
          style={{ left: `${clearanceStartPct * 100}%`, right: 0 }}
        />

        {/* Wall */}
        <div className="absolute top-0 bottom-0 right-0 w-1.5 bg-slate-400 rounded-r" />

        {/* AGV */}
        <div
          className={`absolute top-1 bottom-1 w-4 rounded-md transition-[left] duration-75 ease-linear ${statusColor} ${status === "running" ? "shadow-[0_0_8px_rgba(251,191,36,0.6)]" : ""}`}
          style={{ left: `${agvLeft}%` }}
        >
          <div className="w-2 h-2 rounded-full bg-white/30 mx-auto mt-1" />
        </div>
      </div>

      {/* Readout row */}
      <div className="flex justify-between text-[11px] font-mono text-slate-400">
        <span>{positionM.toFixed(2)}m / {totalDistanceM.toFixed(0)}m</span>
        <span>clearance: {clearanceM.toFixed(1)}m</span>
        <span className={status === "crashed" ? "text-red-400" : status === "safe_stop" ? "text-cyan-400" : "text-slate-500"}>
          {status === "crashed" ? "💥" : status === "safe_stop" ? "🛡️" : ""}
        </span>
      </div>

      {/* Latency config row */}
      <div className="flex justify-between text-[11px] font-mono bg-slate-950/60 rounded px-2 py-1 border border-slate-900">
        <span className={config.cloudLatencyMs === "computed" ? "text-amber-400" : "text-cyan-400"}>
          cloud: {cloudStr}
        </span>
        <span className="text-slate-400">
          {modeStr}
        </span>
        <span className="text-slate-400">
          brake: {config.brakeLatencyMs}ms
        </span>
      </div>

      {/* Viewer annotation */}
      <div className="text-[11px] font-mono text-slate-400 italic leading-tight pt-0.5 border-t border-slate-900/60">
        {archNote}{statusNote}
      </div>
    </div>
  );
}
