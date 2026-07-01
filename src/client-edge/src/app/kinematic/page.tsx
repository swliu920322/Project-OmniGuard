"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  computeKinematicResult,
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
  // ── 1. 可变状态（页面级主逻辑）─────────────────────────────────────────────
  const [params, setParams] = useState<KinematicParams>(DEFAULT_PARAMS);
  const [mode, setMode] = useState<Mode>("cloud");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // ── 2. 派生数据 ───────────────────────────────────────────────────────────
  const result = useMemo(() => computeKinematicResult(params, mode), [params, mode]);

  // ── 3. 事件回调 ───────────────────────────────────────────────────────────
  const handleLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [entry, ...prev]);
  }, []);

  const handleParamChange = useCallback((key: keyof KinematicParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleModeChange = useCallback((next: Mode) => {
    setMode(next);
    setLogs((prev) => [
      {
        timestamp: new Date().toLocaleTimeString(),
        message: `[MODE] Switched to ${next === "cloud" ? "Cloud-Only" : "Edge Fallback"}.`,
      },
      ...prev,
    ]);
  }, []);

  // ── 4. 动画模拟 hook ──────────────────────────────────────────────────────
  const simulation = useKinematicSimulation({
    params,
    result,
    mode,
    onLog: handleLog,
  });

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setMode("cloud");
    setLogs([]);
    simulation.reset();
  }, [simulation]);

  const handleStart = useCallback(() => {
    simulation.reset();
    // Let React flush the reset state before starting the new run.
    requestAnimationFrame(() => simulation.start());
  }, [simulation]);

  // ── 5. 渲染：只负责组装组件与布局骨架 ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <KinematicHeader mode={mode} onModeChange={handleModeChange} onReset={handleReset} />

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-6">
        <FormulaCard params={params} result={result} mode={mode} />

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <ParameterPanel params={params} mode={mode} onChange={handleParamChange} />
          </div>
          <div className="lg:col-span-8">
            <SimulationStage
              params={params}
              result={result}
              mode={mode}
              isRunning={simulation.isRunning}
              agvOffsetPercent={simulation.agvOffsetPercent}
              hasCrashed={simulation.hasCrashed}
              hasStopped={simulation.hasStopped}
              onStart={handleStart}
            />
          </div>
        </section>

        <AuditLog logs={logs} />
      </main>
    </div>
  );
}
