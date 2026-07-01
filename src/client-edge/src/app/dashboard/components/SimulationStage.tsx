"use client";

import React from "react";
import { KinematicParams, Mode, formatLatency, computeBrakingDistanceM } from "../lib/kinematic";

interface SimulationStageProps {
  params: KinematicParams;
  mode: Mode;
  status: "idle" | "running" | "crashed" | "safe_stop";
  positionM: number;
  stepCount: number;
  onStart: () => void;
}

export default function SimulationStage({
  params,
  mode,
  status,
  positionM,
  stepCount,
  onStart,
}: SimulationStageProps) {
  const { agvSpeedMps, clearanceM, totalDistanceM, cloudLatencyMs, brakeLatencyMs } = params;
  const isRunning = status === "running";
  const isCrashed = status === "crashed";
  const isSafeStop = status === "safe_stop";

  const clearanceBoundaryM = Math.max(0, totalDistanceM - clearanceM);
  const detectionS = mode === "cloud" ? cloudLatencyMs / 1000 : brakeLatencyMs / 1000;
  const brakingM = computeBrakingDistanceM(agvSpeedMps, brakeLatencyMs / 1000);

  const pct = totalDistanceM > 0 ? (positionM / totalDistanceM) * 100 : 0;
  const clearancePct = totalDistanceM > 0 ? (clearanceBoundaryM / totalDistanceM) * 100 : 0;
  const brakingPct = totalDistanceM > 0 ? Math.min(100, ((clearanceBoundaryM + brakingM) / totalDistanceM) * 100) : 0;
  const remainingM = Math.max(0, totalDistanceM - positionM);

  return (
    <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-5 md:p-6 shadow-lg backdrop-blur-sm flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h2 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">
            Simulation Stage
          </h2>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            Step {stepCount}
          </span>
          {isRunning && (
            <span className="text-xs font-mono text-cyan-400 animate-pulse">
              {mode === "cloud" ? "☁️ Awaiting cloud response..." : "⚡ Moving..."}
            </span>
          )}
        </div>
        <button
          onClick={onStart}
          disabled={isRunning}
          className={`px-5 py-2 rounded-lg font-bold text-xs tracking-wide uppercase transition shadow-lg ${
            isRunning
              ? "bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.98] border border-cyan-400/20"
          }`}
        >
          {isRunning ? "Running..." : "▶ Run Simulation"}
        </button>
      </div>

      <div className="border border-slate-900 bg-slate-950 rounded-xl relative overflow-hidden h-72 md:h-80">
        {/* Track background */}
        <div className="absolute inset-0">
          {/* Distance markings */}
          <div className="absolute inset-x-0 top-0 h-5 flex">
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((pct) => (
              <div key={pct} className="flex-1 flex items-start justify-center">
                <div className="w-px h-2 bg-slate-800" />
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 top-5 flex text-[8px] font-mono text-slate-700">
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((pct) => {
              const val = ((totalDistanceM * pct) / 100).toFixed(pct === 0 || pct === 100 ? 0 : 0);
              return (
                <div key={pct} className="flex-1 text-center">{val}m</div>
              );
            })}
          </div>
        </div>

        {/* Safety envelope (green zone) */}
        <div
          className="absolute bottom-8 h-16 bg-emerald-500/5 border-r border-emerald-500/20 pointer-events-none"
          style={{ left: "0%", width: `${clearancePct}%` }}
        />

        {/* Clearance zone (yellow/red danger zone) */}
        <div
          className="absolute bottom-8 h-16 bg-red-500/10 border-l border-dashed border-red-500/30 pointer-events-none"
          style={{ left: `${clearancePct}%`, right: "0%" }}
        />

        {/* Wall */}
        <div
          className="absolute bottom-8 h-16 w-[3%] bg-gradient-to-l from-slate-900 to-slate-950 border-l border-slate-800 flex items-center justify-center"
          style={{ right: "0%" }}
        >
          <div
            className={`w-1.5 h-[60%] rounded-full transition-all duration-300 ${
              isCrashed
                ? "bg-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.8)]"
                : "bg-slate-700"
            }`}
          />
        </div>

        {/* Stop boundary marker */}
        {mode === "edge" && (
          <div
            className="absolute bottom-8 h-16 w-[2px] pointer-events-none z-10"
            style={{
              left: `${brakingPct}%`,
              background: "rgba(6,182,212,0.6)",
              boxShadow: "0 0 10px rgba(6,182,212,0.5)",
            }}
          />
        )}

        {/* AGV Robot */}
        <div
          className="absolute bottom-14 -ml-7 w-14 h-14 rounded-full border-2 bg-slate-950 flex items-center justify-center z-20"
          style={{
            left: `${Math.min(pct, 100)}%`,
            borderColor: isCrashed
              ? "#ef4444"
              : isSafeStop
              ? "#06b6d4"
              : mode === "edge"
              ? "#10b981"
              : "#f59e0b",
            boxShadow: isCrashed
              ? "0 0 30px rgba(239,68,68,0.6)"
              : isSafeStop
              ? "0 0 25px rgba(6,182,212,0.4)"
              : "0 0 20px rgba(16,185,129,0.3)",
          }}
        >
          <svg
            className={`w-7 h-7 ${
              isCrashed ? "text-red-400" : isSafeStop ? "text-cyan-400" : "text-emerald-400"
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
        {isCrashed && (
          <div className="absolute inset-0 bg-red-950/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-30 animate-pulse">
            <div className="bg-red-950/90 border border-red-500/50 rounded-xl px-6 py-4 text-center shadow-2xl text-red-400 text-base font-extrabold uppercase tracking-widest flex flex-col items-center space-y-2">
              <span>💥 Collision</span>
              <span className="text-xs text-red-400/80 font-normal normal-case font-mono max-w-xs">
                {mode === "cloud"
                  ? `Cloud RTT ${cloudLatencyMs}ms too slow.`
                  : `Edge latency ${brakeLatencyMs}ms too slow.`}
              </span>
            </div>
          </div>
        )}

        {/* Safe stop overlay */}
        {isSafeStop && (
          <div className="absolute inset-0 bg-cyan-950/20 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-none z-30">
            <div className="bg-cyan-950/90 border border-cyan-500/50 rounded-xl px-6 py-4 text-center shadow-2xl text-cyan-400 text-base font-extrabold uppercase tracking-widest flex flex-col items-center space-y-2">
              <span>🛡️ Safe Stop</span>
              <span className="text-xs text-cyan-400/80 font-normal normal-case font-mono max-w-xs">
                {mode === "edge"
                  ? `Brake latency ${brakeLatencyMs}ms.`
                  : `Cloud detection ${cloudLatencyMs}ms + brake ${brakeLatencyMs}ms.`}
              </span>
            </div>
          </div>
        )}

        {/* Distance readouts */}
        <div className="absolute bottom-2 left-4 right-4 flex justify-between text-xs font-mono text-slate-400">
          <span>Position: {positionM.toFixed(2)}m / {totalDistanceM.toFixed(0)}m</span>
          {isRunning && <span>Remaining: {remainingM.toFixed(1)}m</span>}
          <span>Clearance: {clearanceM.toFixed(1)}m</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono text-slate-400">
        <Readout label="Mode" value={mode === "cloud" ? "Cloud-Only" : "Edge Fallback"} />
        <Readout label="Detection delay" value={formatLatency(detectionS)} />
        <Readout label="Braking distance" value={`${brakingM.toFixed(2)} m`} />
        <Readout label="Status" value={status === "running" ? "Running" : status === "idle" ? "Idle" : status === "crashed" ? "Crashed" : "Safe Stop"} danger={status === "crashed"} success={status === "safe_stop"} />
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  danger,
  success,
}: {
  label: string;
  value: string;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-2.5">
      <div className="text-slate-500 uppercase text-[9px] mb-1">{label}</div>
      <div className={`font-bold text-xs ${danger ? "text-red-400" : success ? "text-cyan-400" : "text-slate-200"}`}>{value}</div>
    </div>
  );
}
