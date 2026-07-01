"use client";

import React, { useCallback, useState } from "react";
import { DEFAULT_PARAMS, KinematicParams, LogEntry, Mode } from "../lib/kinematic";
import { useCompareSimulation } from "../hooks/useCompareSimulation";
import ParameterPanel from "../components/ParameterPanel";
import CompareStage from "../components/CompareStage";
import AuditLog from "../components/AuditLog";
import KinematicHeader from "../components/KinematicHeader";

export default function ComparePage() {
  const [params, setParams] = useState<KinematicParams>(DEFAULT_PARAMS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showEdgeProgress, setShowEdgeProgress] = useState(false);

  const handleLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [entry, ...prev]);
  }, []);

  const handleParamChange = useCallback((key: keyof KinematicParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const sim = useCompareSimulation(params, handleLog, showEdgeProgress);

  const handleLoadPreset = useCallback((preset: KinematicParams) => {
    setParams(preset);
    sim.reset();
    setLogs((prev) => [
      { timestamp: new Date().toLocaleTimeString(), message: `[PRESET] Loaded: ${JSON.stringify(preset)}` },
      ...prev,
    ]);
  }, [sim]);

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setLogs([]);
    sim.reset();
  }, [sim]);

  const handleStart = useCallback(() => {
    setLogs([]);
    sim.start();
  }, [sim]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <KinematicHeader mode="cloud" onModeChange={(m: Mode) => { window.location.href = `/kinematic?mode=${m}`; }} onReset={handleReset} />

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-6">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <ParameterPanel params={params} mode="cloud" onChange={handleParamChange} onLoadPreset={handleLoadPreset} />
          </div>
          <div className="lg:col-span-8 space-y-6">
            <CompareStage params={params} cloud={sim.cloud} edge={sim.edge} onStart={handleStart} />
            <AuditLog
              logs={logs}
              showEdgeProgress={showEdgeProgress}
              onToggleEdgeProgress={() => setShowEdgeProgress((p) => !p)}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
