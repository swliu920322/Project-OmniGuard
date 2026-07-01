"use client";

import React from "react";
import { KinematicParams, KinematicResult, Mode, formatLatency } from "../lib/kinematic";

interface FormulaCardProps {
  params: KinematicParams;
  result: KinematicResult;
  mode: Mode;
}

export default function FormulaCard({ params, result, mode }: FormulaCardProps) {
  const isCloud = mode === "cloud";
  const clearanceCm = params.clearanceM * 100;

  return (
    <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-5 md:p-6 shadow-lg backdrop-blur-sm">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        <div className="space-y-3">
          <div className="text-slate-500 uppercase text-[10px] font-mono font-bold">
            {isCloud ? "Cloud-Only Theorem" : "Edge Fallback Theorem"}
          </div>

          {isCloud ? (
            <div className="font-mono text-sm md:text-base text-slate-200 leading-relaxed">
              V<sub className="text-cyan-400">max</sub> ≤ D
              <sub className="text-emerald-400">clearance</sub> ÷{" "}
              <span className="inline-block border border-slate-700 rounded px-2 py-1">
                L<sub className="text-amber-400">network_rtt</sub> +{" "}
                <span className="inline-block">
                  (T<sub className="text-indigo-400">prompt</sub> + T<sub className="text-indigo-400">completion</sub>)
                </span>{" "}
                ÷ S<sub className="text-purple-400">token_rate</sub>
              </span>
            </div>
          ) : (
            <div className="font-mono text-sm md:text-base text-slate-200 leading-relaxed">
              V<sub className="text-cyan-400">max</sub> ≤ D
              <sub className="text-emerald-400">clearance</sub> ÷{" "}
              <span className="inline-block border border-slate-700 rounded px-2 py-1">
                T<sub className="text-cyan-400">edge_reaction</sub>
              </span>
            </div>
          )}

          <div
            className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded border ${
              result.isSafe
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
            }`}
          >
            {result.isSafe
              ? `Safe: V_agv (${params.agvSpeedMps.toFixed(1)} m/s) ≤ V_max (${result.vMaxMps.toFixed(2)} m/s)`
              : `Unsafe: V_agv (${params.agvSpeedMps.toFixed(1)} m/s) > V_max (${result.vMaxMps.toFixed(2)} m/s)`}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[10px] font-mono text-slate-400">
          <Metric label="Control loop delay" value={formatLatency(result.latencySeconds)} />
          <Metric label="V_max" value={`${result.vMaxMps.toFixed(2)} m/s`} highlight={result.isSafe ? "emerald" : "red"} />
          <Metric
            label="Braking distance"
            value={`${result.brakingDistanceCm.toFixed(1)} cm`}
            highlight={result.isSafe ? "emerald" : "red"}
          />
          <Metric label="Clearance" value={`${clearanceCm.toFixed(1)} cm`} />
          {isCloud ? (
            <>
              <Metric label="Network RTT" value={`${params.networkRttMs} ms`} />
              <Metric label="Token rate" value={`${params.tokenRate} tokens/s`} />
            </>
          ) : (
            <Metric label="Edge reaction" value={`${params.edgeReactionMs} ms`} />
          )}
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
