"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PARAMS,
  KinematicParams,
  LogEntry,
  Mode,
} from "./lib/kinematic";
import { useKinematicSimulation } from "./hooks/useKinematicSimulation";
import KinematicHeader from "./components/KinematicHeader";
import FormulaCard from "./components/FormulaCard";
import ParameterPanel from "./components/ParameterPanel";
import SimulationStage from "./components/SimulationStage";
import AuditLog from "./components/AuditLog";

export default function KinematicPage() {
  const [params, setParams] = useState<KinematicParams>(DEFAULT_PARAMS);
  const [mode, setMode] = useState<Mode>("cloud");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "cloud" || m === "edge") setMode(m);
  }, []);

  const handleLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [entry, ...prev]);
  }, []);

  const handleParamChange = useCallback((key: keyof KinematicParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const simulation = useKinematicSimulation({
    params,
    mode,
    onLog: handleLog,
  });

  const handleLoadPreset = useCallback((preset: KinematicParams) => {
    setParams(preset);
    simulation.reset();
    setLogs((prev) => [
      {
        timestamp: new Date().toLocaleTimeString(),
        message: `[PRESET] Loaded preset: ${JSON.stringify(preset)}`,
      },
      ...prev,
    ]);
  }, [simulation]);

  const handleModeChange = useCallback((next: Mode) => {
    setMode(next);
    simulation.reset();
    setLogs((prev) => [
      {
        timestamp: new Date().toLocaleTimeString(),
        message: `[MODE] Switched to ${next === "cloud" ? "Cloud-Only" : "Edge Fallback"}.`,
      },
      ...prev,
    ]);
  }, [simulation]);

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setMode("cloud");
    setLogs([]);
    simulation.reset();
  }, [simulation]);

  const handleStart = useCallback(() => {
    setLogs([]);
    simulation.start();
  }, [simulation]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <KinematicHeader mode={mode} onModeChange={handleModeChange} onReset={handleReset} />

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-6">
        <FormulaCard params={params} mode={mode} />

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <ParameterPanel params={params} mode={mode} onChange={handleParamChange} onLoadPreset={handleLoadPreset} />
          </div>
          <div className="lg:col-span-8">
            <SimulationStage
              params={params}
              mode={mode}
              status={simulation.status}
              positionM={simulation.positionM}
              stepCount={simulation.stepCount}
              onStart={handleStart}
            />
          </div>
        </section>

        <AuditLog logs={logs} />
      </main>
    </div>
  );
}
