"use client";

import React from "react";
import { KinematicParams, Mode, formatLatency, computeBrakingDistanceM } from "../lib/kinematic";

interface FormulaCardProps {
  params: KinematicParams;
  mode: Mode;
}

export default function FormulaCard({ params, mode }: FormulaCardProps) {
  const { agvSpeedMps, clearanceM, totalDistanceM, cloudLatencyMs, edgeReactionMs } = params;
  const isCloud = mode === "cloud";

  const latencyS = isCloud ? cloudLatencyMs / 1000 : edgeReactionMs / 1000;
  const brakingM = computeBrakingDistanceM(agvSpeedMps, latencyS);
  const vMaxMps = latencyS > 0 ? clearanceM / latencyS : 0;
  const isSafe = agvSpeedMps <= vMaxMps;

  return (
    <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-5 md:p-6 shadow-lg backdrop-blur-sm">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        <div className="space-y-3">
          <div className="text-slate-500 uppercase text-[10px] font-mono font-bold">
            {isCloud ? "Cloud-Only Theorem" : "Edge Fallback Theorem"}
          </div>

          {/* Formula */}
          <div className="font-mono text-sm md:text-base text-slate-200 leading-relaxed">
            V<sub className="text-cyan-400">max</sub> ≤ D
            <sub className="text-emerald-400">clearance</sub> ÷{" "}
            <span className="inline-block border border-slate-700 rounded px-2 py-1">
              T<sub className={isCloud ? "text-amber-400" : "text-cyan-400"}>
                {isCloud ? "cloud" : "edge"}
              </sub>
            </span>
          </div>

          <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
            {isCloud
              ? "Cloud control loop: one request-response cycle determines max safe speed."
              : "Edge sensor bypass: local processing avoids network round-trip."}
          </div>

          <div
            className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded border ${
              isSafe
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
            }`}
          >
            {isSafe
              ? `Safe: V_agv (${agvSpeedMps.toFixed(1)} m/s) ≤ V_max (${vMaxMps.toFixed(2)} m/s)`
              : `Unsafe: V_agv (${agvSpeedMps.toFixed(1)} m/s) > V_max (${vMaxMps.toFixed(2)} m/s)`}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[10px] font-mono text-slate-400">
          <Metric label="Control loop delay" value={formatLatency(latencyS)} />
          <Metric label="V_max" value={`${vMaxMps.toFixed(2)} m/s`} highlight={isSafe ? "emerald" : "red"} />
          <Metric label="Braking distance" value={`${brakingM.toFixed(2)} m`} highlight={isSafe ? "emerald" : "red"} />
          <Metric label="Track length" value={`${totalDistanceM.toFixed(0)} m`} />
          <Metric label="Clearance zone" value={`${clearanceM.toFixed(1)} m`} />
          <Metric label={isCloud ? "Cloud latency" : "Edge reaction"} value={isCloud ? `${cloudLatencyMs} ms` : `${edgeReactionMs} ms`} />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "emerald" | "red" | "cyan";
}) {
  const color =
    highlight === "emerald"
      ? "text-emerald-400"
      : highlight === "red"
      ? "text-red-400"
      : highlight === "cyan"
      ? "text-cyan-400"
      : "text-slate-200";

  return (
    <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-2.5">
      <div className="text-slate-500 uppercase text-[9px] mb-1">{label}</div>
      <div className={`font-bold text-xs ${color}`}>{value}</div>
    </div>
  );
}
