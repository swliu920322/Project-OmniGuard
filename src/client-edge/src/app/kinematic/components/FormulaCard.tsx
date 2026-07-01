"use client";

import React from "react";
import { KinematicParams, Mode, formatLatency, computeBrakingDistanceM } from "../lib/kinematic";

interface FormulaCardProps {
  params: KinematicParams;
  mode: Mode;
}

export default function FormulaCard({ params, mode }: FormulaCardProps) {
  const { agvSpeedMps, clearanceM, totalDistanceM, cloudLatencyMs, edgeLatencyMs, brakeLatencyMs } = params;
  const isCloud = mode === "cloud";

  const detectionS = isCloud ? cloudLatencyMs / 1000 : edgeLatencyMs / 1000;
  const reactionS = brakeLatencyMs / 1000;
  const totalReactionS = detectionS + reactionS;
  const brakingM = computeBrakingDistanceM(agvSpeedMps, reactionS);
  const vMaxMps = totalReactionS > 0 ? clearanceM / totalReactionS : 0;
  const isSafe = agvSpeedMps <= vMaxMps;

  // During detection delay the AGV travels unchecked
  const detectionDistanceM = agvSpeedMps * detectionS;

  return (
    <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-5 md:p-6 shadow-lg backdrop-blur-sm">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        <div className="space-y-3">
          <div className="text-slate-500 uppercase text-xs font-mono font-bold">
            {isCloud ? "Cloud-Only Theorem" : "Edge Fallback Theorem"}
          </div>

          {/* Formula */}
          <div className="text-sm font-mono text-slate-200 leading-relaxed space-y-1">
            <div>
              V<sub>max</sub> = D<sub>clearance</sub> ÷ (T<sub className={isCloud ? "text-amber-400" : "text-cyan-400"}>detect</sub> + T<sub>brake</sub>)
            </div>
            <div className="text-[11px] text-slate-400">
              {isCloud
                ? `Detection ${formatLatency(detectionS)} + braking ${formatLatency(reactionS)} = ${formatLatency(totalReactionS)} total`
                : `Edge latency ${edgeLatencyMs}ms + brake ${brakeLatencyMs}ms`}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono leading-relaxed">
            {isCloud
              ? `Cloud: AGV travels ~${detectionDistanceM.toFixed(1)}m before response.`
              : `Edge: AGV travels ~${detectionDistanceM.toFixed(3)}m during processing.`}
            {` Brake latency ${brakeLatencyMs}ms → ${brakingM.toFixed(2)}m (same hardware).`}
          </div>

          <div
            className={`inline-flex items-center text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded border ${
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono text-slate-400">
          <Metric label="Detection delay" value={formatLatency(detectionS)} />
          <Metric label="Detection travel" value={`${detectionDistanceM.toFixed(isCloud ? 1 : 3)} m`} />
          <Metric label="Braking distance" value={`${brakingM.toFixed(2)} m`} />
          <Metric label="V_max (worst-case)" value={`${vMaxMps.toFixed(2)} m/s`} highlight={isSafe ? "emerald" : "red"} />
          <Metric label="Clearance zone" value={`${clearanceM.toFixed(1)} m`} />
          <Metric label={isCloud ? "Cloud RTT" : "Edge latency"} value={isCloud ? `${cloudLatencyMs} ms` : `${edgeLatencyMs} ms`} />
          <Metric label="Brake latency" value={`${brakeLatencyMs} ms`} />
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
      <div className="text-slate-500 uppercase text-[10px] mb-1">{label}</div>
      <div className={`font-bold text-sm ${color}`}>{value}</div>
    </div>
  );
}
