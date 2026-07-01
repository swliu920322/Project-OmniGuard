"use client";

import React from "react";
import { TrackId, TrackConfig, Scenario } from "../config/scenarios";
import { computeCloudLatencyMs } from "../../shared/physics";

interface AgentPipelineOverlayProps {
  tracks: Record<TrackId, { status: "idle" | "running" | "crashed" | "safe_stop" }>;
  scenario: Scenario;
}

interface AgentState {
  label: string;
  icon: string;
  statusText: string;
  color: "slate" | "cyan" | "emerald" | "red" | "amber" | "gray";
  subtitle: string;
}

function getTrackCloudStatus(t: TrackConfig, trackStatus: string): AgentState {
  if (trackStatus === "idle") return { label: "Cloud Commander", icon: "☁️", statusText: "Awaiting", color: "slate", subtitle: "Cloud-based LLM reasoning (slow)" };
  if (trackStatus === "running") {
    const isComputing = t.cloudLatencyMs === "computed" || (typeof t.cloudLatencyMs === "number" && t.cloudLatencyMs > 3000);
    return { label: "Cloud Commander", icon: "☁️", statusText: isComputing ? "Generating..." : "Detecting...", color: "cyan", subtitle: "Cloud-based LLM reasoning (slow)" };
  }

  const cloudLatencyMs = t.cloudLatencyMs === "computed" && t.llm
    ? computeCloudLatencyMs(t.llm)
    : t.cloudLatencyMs as number;

  if (trackStatus === "crashed") {
    if (t.cloudLatencyMs === "computed" || cloudLatencyMs > 5000) {
      return { label: "Cloud Commander", icon: "☁️", statusText: "Returned too late", color: "red", subtitle: "Cloud-based LLM reasoning (slow)" };
    }
    return { label: "Cloud Commander", icon: "☁️", statusText: "Detected too late", color: "red", subtitle: "Cloud-based LLM reasoning (slow)" };
  }

  if (trackStatus === "safe_stop") {
    if (t.edgeLatencyMs !== null) {
      return { label: "Cloud Commander", icon: "☁️", statusText: "Too slow, edge won", color: "amber", subtitle: "Cloud-based LLM reasoning (slow)" };
    }
    return { label: "Cloud Commander", icon: "☁️", statusText: "In time", color: "emerald", subtitle: "Cloud-based LLM reasoning (slow)" };
  }

  return { label: "Cloud Commander", icon: "☁️", statusText: "Awaiting", color: "slate", subtitle: "Cloud-based LLM reasoning (slow)" };
}

function getTrackEdgeStatus(t: TrackConfig, trackStatus: string): AgentState {
  if (t.edgeLatencyMs === null) {
    return { label: "Edge Guardian", icon: "⚡", statusText: "Disabled", color: "red", subtitle: "Edge compute reflex (fast)" };
  }
  if (trackStatus === "idle") return { label: "Edge Guardian", icon: "⚡", statusText: "Standby", color: "slate", subtitle: "Edge compute reflex (fast)" };
  if (trackStatus === "running") return { label: "Edge Guardian", icon: "⚡", statusText: "Monitoring", color: "cyan", subtitle: "Edge compute reflex (fast)" };
  if (trackStatus === "safe_stop") return { label: "Edge Guardian", icon: "⚡", statusText: "Overridden & safe", color: "emerald", subtitle: "Edge compute reflex (fast)" };
  return { label: "Edge Guardian", icon: "⚡", statusText: "Failed to stop", color: "red", subtitle: "Edge compute reflex (fast)" };
}

function getTrackBrakeStatus(trackStatus: string): AgentState {
  if (trackStatus === "crashed") {
    return { label: "Emergency Brake", icon: "🛑", statusText: "Engaged but too late", color: "red", subtitle: "Hardware safety brake" };
  }
  return { label: "Emergency Brake", icon: "🛑", statusText: "Armed", color: "slate", subtitle: "Hardware safety brake" };
}

const colorMap: Record<string, string> = {
  slate: "bg-slate-900/50 border-slate-800 text-slate-400",
  cyan: "bg-cyan-950/30 border-cyan-700/30 text-cyan-300 animate-pulse",
  emerald: "bg-emerald-950/30 border-emerald-700/30 text-emerald-300",
  red: "bg-red-950/30 border-red-700/30 text-red-300",
  amber: "bg-amber-950/30 border-amber-700/30 text-amber-300",
  gray: "bg-slate-950/60 border-slate-800 text-slate-500",
};

const badgeColorMap: Record<string, string> = {
  slate: "bg-slate-950 text-slate-500 border-slate-800",
  cyan: "bg-cyan-950/80 text-cyan-400 border-cyan-500/30",
  emerald: "bg-emerald-950/80 text-emerald-400 border-emerald-500/30",
  red: "bg-red-950/80 text-red-400 border-red-500/30",
  amber: "bg-amber-950/80 text-amber-400 border-amber-500/30",
  gray: "bg-slate-950 text-slate-600 border-slate-800",
};

function AgentCard({ agent }: { agent: AgentState }) {
  return (
    <div className={`border rounded-xl p-3 transition-all duration-500 ${colorMap[agent.color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold">{agent.icon} {agent.label}</span>
        <span className={`text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${badgeColorMap[agent.color]}`}>
          {agent.statusText}
        </span>
      </div>
      <div className="text-[11px] font-mono text-slate-400">{agent.subtitle}</div>
    </div>
  );
}

const TRACK_LABELS: Record<TrackId, string> = { agv01: "AGV-01", agv02: "AGV-02", agv03: "AGV-03" };

export default function AgentPipelineOverlay({ tracks, scenario }: AgentPipelineOverlayProps) {
  const ids: TrackId[] = ["agv01", "agv02", "agv03"];

  // Pick the most interesting (worst) track: crashed → running → safe_stop → idle
  // running > safe_stop because a running AGV at the wall hasn't resolved yet
  const priority: Record<string, number> = { crashed: 3, running: 2, safe_stop: 1, idle: 0 };
  const worstId = ids.reduce((a, b) =>
    (priority[tracks[a].status] ?? 0) > (priority[tracks[b].status] ?? 0) ? a : b,
  );
  const cfg = scenario.tracks[worstId];
  const status = tracks[worstId].status;

  const cloudAgent = getTrackCloudStatus(cfg, status);
  const edgeAgent = getTrackEdgeStatus(cfg, status);
  const brakeAgent = getTrackBrakeStatus(status);

  return (
    <div className="border border-slate-900 bg-slate-950/40 rounded-xl p-3 flex flex-col min-h-[184px]">
      <h3 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold mb-3">
        Agent Pipeline
      </h3>

      <div className="text-xs font-mono text-slate-400 mb-2 pl-0.5">
        Showing: <span className="text-cyan-400 font-bold">{TRACK_LABELS[worstId]}</span>
        {" "}({cfg.label})
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-0">
        <AgentCard agent={cloudAgent} />
        <div className="text-slate-700 text-[10px] text-center py-1">▼</div>
        <AgentCard agent={edgeAgent} />
        <div className="text-slate-700 text-[10px] text-center py-1">▼</div>
        <AgentCard agent={brakeAgent} />
      </div>
    </div>
  );
}
