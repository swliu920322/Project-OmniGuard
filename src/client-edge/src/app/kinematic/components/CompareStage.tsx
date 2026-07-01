"use client";

import React from "react";
import { KinematicParams, computeBrakingDistanceM } from "../lib/kinematic";

interface TrackState {
  status: "idle" | "running" | "crashed" | "safe_stop";
  positionM: number;
}

interface CompareStageProps {
  params: KinematicParams;
  cloud: TrackState & { stepCount: number };
  edge: TrackState;
  onStart: () => void;
}

function Track({
  label,
  sub,
  color,
  params,
  status,
  positionM,
  stepCount,
  isEdge,
}: {
  label: string;
  sub: string;
  color: string;
  params: KinematicParams;
  status: string;
  positionM: number;
  stepCount?: number;
  isEdge: boolean;
}) {
  const { agvSpeedMps, totalDistanceM, clearanceM, cloudLatencyMs, brakeLatencyMs } = params;
  const clearanceBoundaryM = Math.max(0, totalDistanceM - clearanceM);
  const brakingM = computeBrakingDistanceM(agvSpeedMps, brakeLatencyMs / 1000);
  const pct = totalDistanceM > 0 ? (positionM / totalDistanceM) * 100 : 0;
  const clearancePct = totalDistanceM > 0 ? (clearanceBoundaryM / totalDistanceM) * 100 : 0;
  const isRunning = status === "running";
  const isCrashed = status === "crashed";
  const isSafeStop = status === "safe_stop";

  return (
    <div className="flex-1 border border-slate-900 bg-slate-900/10 rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold uppercase font-mono" style={{ color }}>{label}</span>
          {isRunning && <span className="text-[9px] text-cyan-400 animate-pulse font-mono">Running...</span>}
          {isCrashed && <span className="text-[9px] text-red-400 font-bold font-mono">💥 CRASHED</span>}
          {isSafeStop && <span className="text-[9px] text-cyan-400 font-bold font-mono">🛡️ SAFE STOP</span>}
        </div>
        {!isEdge && stepCount !== undefined && (
          <span className="text-[9px] font-mono text-slate-600">Step {stepCount}</span>
        )}
      </div>

      <div className="text-[9px] text-slate-600 font-mono mb-2">{sub}</div>

      <div className="relative border border-slate-800 bg-slate-950 rounded-lg h-16 overflow-hidden flex-shrink-0">
        {/* Green safety zone */}
        <div className="absolute inset-y-0 left-0 bg-emerald-500/5 border-r border-emerald-500/20" style={{ width: `${clearancePct}%` }} />
        {/* Red danger zone */}
        <div className="absolute inset-y-0 bg-red-500/10 border-l border-dashed border-red-500/30" style={{ left: `${clearancePct}%`, right: "0%" }} />

        {/* Wall */}
        <div className="absolute inset-y-0 w-[3%] bg-gradient-to-l from-slate-900 to-slate-950 border-l border-slate-800 flex items-center justify-center" style={{ right: "0%" }}>
          <div className={`w-1 h-[50%] rounded-full ${isCrashed ? "bg-red-500 animate-pulse" : "bg-slate-700"}`} />
        </div>

        {/* AGV */}
        <div
          className="absolute top-1/2 -mt-4 -ml-4 w-8 h-8 rounded-full border-2 bg-slate-950 flex items-center justify-center z-10 transition-all duration-75"
          style={{
            left: `${Math.min(pct, 100)}%`,
            borderColor: isCrashed ? "#ef4444" : isSafeStop ? "#06b6d4" : isEdge ? "#10b981" : "#f59e0b",
            boxShadow: isCrashed ? "0 0 20px rgba(239,68,68,0.6)" : isSafeStop ? "0 0 15px rgba(6,182,212,0.4)" : "none",
          }}
        >
          <svg className={`w-4 h-4 ${isCrashed ? "text-red-400" : isSafeStop ? "text-cyan-400" : "text-emerald-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>

        {/* Position readout */}
        <div className="absolute bottom-1 left-2 text-[8px] font-mono text-slate-600">
          {positionM.toFixed(2)}m / {totalDistanceM.toFixed(0)}m
        </div>
      </div>
    </div>
  );
}

export default function CompareStage({ params, cloud, edge, onStart }: CompareStageProps) {
  const isRunning = cloud.status === "running" || edge.status === "running";

  return (
    <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">
          Cloud vs Edge — Side by Side
        </h2>
        <button
          onClick={onStart}
          disabled={isRunning}
          className={`px-4 py-2 rounded-lg font-bold text-[10px] tracking-wide uppercase transition shadow-lg ${
            isRunning
              ? "bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
          }`}
        >
          {isRunning ? "Running..." : "▶ Run Both"}
        </button>
      </div>

      <div className="flex space-x-3">
        <Track
          label="☁️ Cloud Only"
          sub={`RTT ${params.cloudLatencyMs}ms + brake ${params.brakeLatencyMs}ms`}
          color="#818cf8"
          params={params}
          status={cloud.status}
          positionM={cloud.positionM}
          stepCount={cloud.stepCount}
          isEdge={false}
        />
        <Track
          label="⚡ Edge Fallback"
          sub={`Latency ${params.edgeLatencyMs}ms + brake ${params.brakeLatencyMs}ms`}
          color="#06b6d4"
          params={params}
          status={edge.status}
          positionM={edge.positionM}
          isEdge={true}
        />
      </div>
    </div>
  );
}
