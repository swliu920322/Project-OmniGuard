"use client";

import React, { useState } from "react";
import { Scenario, SCENARIOS, ScenarioId } from "../config/scenarios";
import { LLMBreakdownParams, computeCloudLatencyMs } from "../../shared/physics";

interface FleetControlPanelProps {
  activeScenario: Scenario;
  onSelectScenario: (id: string) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  globalSpeedMps: number;
  globalClearanceM: number;
  onUpdateSpeed: (v: number) => void;
  onUpdateClearance: (c: number) => void;
  tokenLLM: LLMBreakdownParams;
  onUpdateTokenParam: (key: keyof LLMBreakdownParams, value: number) => void;
  onResume: () => void;
  simPhase: "idle" | "running" | "paused";
  fleetStatus: string;
}

function SliderRow({ label, unit, min, max, step, value, onChange }: {
  label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center space-x-3 text-xs font-mono">
      <span className="text-slate-500 w-24 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 appearance-none bg-slate-800 rounded-full cursor-pointer accent-cyan-500"
      />
      <span className="text-cyan-400 font-bold w-16 text-right">{value.toFixed(step >= 1 ? 0 : 1)} {unit}</span>
    </div>
  );
}

export default function FleetControlPanel({
  activeScenario, onSelectScenario, onStart, onPause, onResume, onReset,
  globalSpeedMps, globalClearanceM, onUpdateSpeed, onUpdateClearance,
  tokenLLM, onUpdateTokenParam, simPhase, fleetStatus,
}: FleetControlPanelProps) {
  const [showToken, setShowToken] = useState(false);
  const isRunning = simPhase === "running";
  const isPaused = simPhase === "paused";
  const isCompleted = isPaused && fleetStatus !== "paused";
  const hasTokenTrack = activeScenario.tracks.agv03.cloudLatencyMs === "computed";

  const computedCloudMs = hasTokenTrack ? computeCloudLatencyMs(tokenLLM) : 0;

  return (
    <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-4 space-y-4">
      {/* Scenario buttons */}
      <div className="grid grid-cols-2 gap-2">
        {SCENARIOS.map((s) => {
          const isActive = activeScenario.id === s.id;
          const isDanger = s.id === "edge-disabled";
          return (
            <button
              key={s.id}
              onClick={() => onSelectScenario(s.id)}
              className={`text-left px-2.5 py-1.5 rounded border transition ${
                isActive
                  ? isDanger
                    ? "bg-red-950/60 border-red-700/50"
                    : "bg-cyan-950/60 border-cyan-700/50"
                  : "bg-slate-900/60 border-slate-700/50 hover:bg-slate-800/60"
              }`}
            >
              <div className={`text-xs font-mono font-bold uppercase ${isActive ? (isDanger ? "text-red-400" : "text-cyan-400") : "text-slate-300"}`}>
                {s.label}
              </div>
              <div className={`text-[11px] font-mono mt-0.5 leading-snug ${isActive ? "text-slate-400" : "text-slate-500"}`}>
                {s.oneLiner}
              </div>
            </button>
          );
        })}
      </div>

      {/* Playback controls */}
      <div className="flex items-center space-x-3">
        <button
          onClick={isCompleted ? onStart : isPaused ? onResume : onStart}
          disabled={isRunning}
          className="text-xs font-mono font-bold uppercase px-3 py-1.5 rounded border bg-emerald-950/60 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/60 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          {isCompleted ? "▶ Play" : isPaused ? "▶ Resume" : "▶ Play"}
        </button>
        <button
          onClick={onPause}
          disabled={!isRunning}
          className="text-xs font-mono font-bold uppercase px-3 py-1.5 rounded border bg-amber-950/60 border-amber-700/50 text-amber-400 hover:bg-amber-900/60 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          ⏸ Pause
        </button>
        <button
          onClick={onReset}
          className="text-xs font-mono font-bold uppercase px-3 py-1.5 rounded border bg-slate-900/60 border-slate-700/50 text-slate-400 hover:bg-slate-800/60 transition"
        >
          ↺ Reset
        </button>
      </div>

      {/* Global sliders */}
      <div className="space-y-2 pt-2 border-t border-slate-900">
        <SliderRow label="Speed" unit="m/s" min={0.1} max={3.0} step={0.1} value={globalSpeedMps} onChange={onUpdateSpeed} />
        <SliderRow label="Clearance" unit="m" min={0.1} max={10.0} step={0.1} value={globalClearanceM} onChange={onUpdateClearance} />
      </div>

      {/* Token breakdown drawer — live controls for AGV-03 */}
      <div className="border-t border-slate-900 pt-2">
        <button
          onClick={() => setShowToken(!showToken)}
          className="text-xs font-mono font-bold text-slate-500 hover:text-slate-400 transition flex items-center space-x-1"
        >
          <span>{showToken ? "▼" : "▶"}</span>
          <span>Token Breakdown {hasTokenTrack ? "(AGV-03 Cloud)" : ""}</span>
        </button>

        {showToken && (
          <div className="mt-3 space-y-2 pl-3 border-l border-slate-800">
            <div className="text-[11px] font-mono text-slate-400 mb-1 leading-snug">
              These sliders <span className="text-amber-400">control AGV-03's cloud latency in real-time</span>.
              Scenario presets set initial values; adjust here to find the crash boundary.
            </div>
            <SliderRow label="Network RTT" unit="ms" min={5} max={2000} step={10} value={tokenLLM.networkRttMs} onChange={(v) => onUpdateTokenParam("networkRttMs", v)} />
            <SliderRow label="Prompt" unit="tok" min={100} max={4000} step={100} value={tokenLLM.promptTokens} onChange={(v) => onUpdateTokenParam("promptTokens", v)} />
            <SliderRow label="Completion" unit="tok" min={100} max={8000} step={100} value={tokenLLM.completionTokens} onChange={(v) => onUpdateTokenParam("completionTokens", v)} />
            <SliderRow label="Token Rate" unit="tok/s" min={10} max={500} step={5} value={tokenLLM.tokenRateTokS} onChange={(v) => onUpdateTokenParam("tokenRateTokS", v)} />
            {hasTokenTrack && (
              <div className="text-[11px] font-mono text-slate-400 pt-1">
                Computed cloudLatencyMs: <span className="text-cyan-400 font-bold">{computedCloudMs.toFixed(0)} ms</span>
                {" "}(= {(computedCloudMs / 1000).toFixed(1)} s)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
