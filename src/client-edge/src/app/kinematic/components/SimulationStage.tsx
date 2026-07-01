"use client";

import React from "react";
import { KinematicParams, KinematicResult, Mode, formatLatency } from "../lib/kinematic";

interface SimulationStageProps {
  params: KinematicParams;
  result: KinematicResult;
  mode: Mode;
  isRunning: boolean;
  agvOffsetPercent: number;
  hasCrashed: boolean;
  hasStopped: boolean;
  onStart: () => void;
}

export default function SimulationStage({
  params,
  result,
  mode,
  isRunning,
  agvOffsetPercent,
  hasCrashed,
  hasStopped,
  onStart,
}: SimulationStageProps) {
  const { latencySeconds, vMaxMps, isSafe, brakingDistanceCm } = result;
  const clearanceCm = params.clearanceM * 100;

  const trackLengthCm = Math.max(clearanceCm * 1.5, 100);
  const wallPercent = (clearanceCm / trackLengthCm) * 100;
  const stopPercent = Math.min(wallPercent, (brakingDistanceCm / trackLengthCm) * 100);

  return (
    <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-5 md:p-6 shadow-lg backdrop-blur-sm flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">
          Simulation Stage
        </h2>
        <button
          onClick={onStart}
          disabled={isRunning}
          className={`px-5 py-2 rounded-lg font-bold text-[10px] tracking-wide uppercase transition shadow-lg ${
            isRunning
              ? "bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.98] border border-cyan-400/20"
          }`}
        >
          {isRunning ? "Running..." : "▶ Run Simulation"}
        </button>
      </div>

      <div className="border border-slate-900 bg-slate-950 rounded-xl relative overflow-hidden h-72 md:h-80">
        {/* Track grid */}
        <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-10 border-x border-slate-900/30 pointer-events-none">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border-r border-slate-900/15 h-full" />
          ))}
        </div>

        {/* Safety envelope */}
        <div
          className="absolute top-0 bottom-0 bg-emerald-500/5 border-r border-emerald-500/20 pointer-events-none"
          style={{ left: "0%", right: `${100 - stopPercent}%` }}
        />

        {/* Warning zone */}
        <div
          className="absolute top-0 bottom-0 bg-amber-500/5 border-l border-dashed border-amber-500/30 pointer-events-none"
          style={{ left: `${stopPercent}%`, right: `${100 - wallPercent}%` }}
        />

        {/* Wall */}
        <div
          className="absolute top-0 bottom-0 w-[3%] bg-gradient-to-l from-slate-900 to-slate-950 border-l border-slate-800 flex items-center justify-center"
          style={{ right: `${100 - wallPercent}%` }}
        >
          <div
            className={`w-1.5 h-[80%] rounded-full transition-all duration-300 ${
              hasCrashed
                ? "bg-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.8)]"
                : isSafe
                ? "bg-slate-700"
                : "bg-amber-500/60"
            }`}
          />
        </div>

        {/* Stop boundary marker */}
        <div
          className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
          style={{
            left: `${stopPercent}%`,
            background: mode === "edge" ? "rgba(6,182,212,0.6)" : "rgba(245,158,11,0.6)",
            boxShadow: mode === "edge" ? "0 0 10px rgba(6,182,212,0.5)" : "0 0 10px rgba(245,158,11,0.3)",
          }}
        />

        {/* AGV */}
        <div
          className="absolute top-1/2 -mt-7 -ml-7 w-14 h-14 rounded-full border-2 bg-slate-950 flex items-center justify-center transition-all duration-75 z-10"
          style={{
            left: `${agvOffsetPercent}%`,
            borderColor: hasCrashed
              ? "#ef4444"
              : mode === "edge"
              ? "#06b6d4"
              : isSafe
              ? "#10b981"
              : "#f59e0b",
            boxShadow: hasCrashed
              ? "0 0 30px rgba(239,68,68,0.6)"
              : mode === "edge"
              ? "0 0 25px rgba(6,182,212,0.4)"
              : "0 0 20px rgba(16,185,129,0.3)",
          }}
        >
          <svg
            className={`w-7 h-7 ${
              hasCrashed ? "text-red-400" : mode === "edge" ? "text-cyan-400" : "text-emerald-400"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
        </div>

        {/* Crash overlay */}
        {hasCrashed && (
          <div className="absolute inset-0 bg-red-950/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-20 animate-pulse">
            <div className="bg-red-950/90 border border-red-500/50 rounded-xl px-6 py-4 text-center shadow-2xl text-red-400 text-base font-extrabold uppercase tracking-widest flex flex-col items-center space-y-2">
              <span>💥 Collision</span>
              <span className="text-xs text-red-400/80 font-normal normal-case font-mono max-w-xs">
                Cloud-only control loop ({formatLatency(latencySeconds)}) exceeded physical braking
                distance.
              </span>
            </div>
          </div>
        )}

        {/* Safe stop overlay */}
        {hasStopped && mode === "edge" && (
          <div className="absolute inset-0 bg-cyan-950/20 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-none z-20">
            <div className="bg-cyan-950/90 border border-cyan-500/50 rounded-xl px-6 py-4 text-center shadow-2xl text-cyan-400 text-base font-extrabold uppercase tracking-widest flex flex-col items-center space-y-2">
              <span>🛡️ Edge Safe Stop</span>
              <span className="text-xs text-cyan-400/80 font-normal normal-case font-mono max-w-xs">
                Ultrasonic/LiDAR bypass halted AGV within {params.edgeReactionMs} ms.
              </span>
            </div>
          </div>
        )}

        {/* Distance readouts */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-mono text-slate-500">
          <span>Track: {trackLengthCm.toFixed(0)} cm</span>
          <span>Stop boundary: {brakingDistanceCm.toFixed(1)} cm</span>
          <span>Wall: {clearanceCm.toFixed(1)} cm</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-mono text-slate-400">
        <Readout label="Mode" value={mode === "cloud" ? "Cloud-Only" : "Edge Fallback"} />
        <Readout label="Loop latency" value={formatLatency(latencySeconds)} />
        <Readout label="Braking distance" value={`${brakingDistanceCm.toFixed(1)} cm`} />
        <Readout label="Status" value={isSafe ? "SAFE" : "UNSAFE"} danger={!isSafe} />
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-2.5">
      <div className="text-slate-500 uppercase text-[9px] mb-1">{label}</div>
      <div className={`font-bold text-xs ${danger ? "text-red-400" : "text-slate-200"}`}>{value}</div>
    </div>
  );
}
