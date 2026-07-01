"use client";

import { useEffect, useState } from "react";
import { DEFAULT_DISPLAY_LATENCY_MS, JITTER_DELAY_MS, LATENCY_HIGH_THRESHOLD_MS, TENANT_SCENARIOS } from "./config/simulation";
import { computeActualLatencyMs } from "./lib/simulation";
import ControlPanel from "./components/ControlPanel";
import PhysicalTwinVisualizer from "./components/PhysicalTwinVisualizer";
import CloudTopologyFlowchart from "./components/CloudTopologyFlowchart";
import AgentOrchestratorFlow from "./components/AgentOrchestratorFlow";
import InfraTelemetryPanel from "./components/InfraTelemetryPanel";
import AuditTerminalConsole from "./components/AuditTerminalConsole";
import SandboxPanel from "./components/SandboxPanel";
import { useFleetSimulation } from "./hooks/useFleetSimulation";

export default function FleetDashboard() {
  // Hydration control to prevent Server-Client mismatch issues
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [viewMode, setViewMode] = useState<"physical" | "topology" | "sandbox">("physical");

  const fleet = useFleetSimulation();

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-cyan-400">Loading Fleet Control Plane...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Banner Header */}
      <header className="border-b border-slate-900 bg-slate-900/30 backdrop-blur-md sticky top-0 z-50 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            Embodied AI Fleet Control Plane
          </h1>
          <span className="text-xs uppercase bg-slate-900 px-2.5 py-1 rounded border border-slate-800 text-slate-400 font-mono">
            Digital Twin v2.5
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <a
            href="/kinematic"
            className="text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 transition border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 rounded"
          >
            🧮 Kinematic Theorem →
          </a>
          <a
            href="/kinematic/compare"
            className="text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 transition border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 rounded"
          >
            ⚖️ Compare
          </a>
          <div className="text-xs font-mono text-slate-500">
            Sensor Refresh Interval: <span className="text-cyan-400 font-bold">1Hz</span> (Real-Time MQTT Loop)
          </div>
        </div>
      </header>

      {/* Control / Config Section */}
      <ControlPanel {...fleet} />

      {/* Error Alert Bar */}
      {fleet.error && (
        <div className="bg-red-950/20 border-y border-red-900/50 py-3 px-6 text-sm text-red-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-base font-bold">⚠️ Connection Error:</span>
            <span>{fleet.error}. Verify local Function host is running on port 7071.</span>
          </div>
          {/* Error clearing is a local page concern, not part of the simulation hook. */}
          <button
            onClick={() => fleet.reset()}
            className="text-red-400 hover:text-red-300 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main 3-Column Dashboard Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Digital Twin / Cloud Topology / Orchestration Studio (Span 4) */}
        <div className="lg:col-span-4 border border-slate-900 bg-slate-900/10 rounded-2xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-900">
                <button
                  onClick={() => setViewMode("physical")}
                  className={`text-[10px] uppercase font-mono px-2.5 py-1 rounded transition ${
                    viewMode === "physical"
                      ? "bg-slate-900 border border-slate-800 text-cyan-400 font-bold"
                      : "text-slate-500 hover:text-slate-400"
                  }`}
                >
                  Physical Twin
                </button>
                <button
                  onClick={() => setViewMode("topology")}
                  className={`text-[10px] uppercase font-mono px-2.5 py-1 rounded transition ${
                    viewMode === "topology"
                      ? "bg-slate-900 border border-slate-800 text-cyan-400 font-bold"
                      : "text-slate-500 hover:text-slate-400"
                  }`}
                >
                  Cloud Topology
                </button>
                <button
                  onClick={() => setViewMode("sandbox")}
                  className={`text-[10px] uppercase font-mono px-2.5 py-1 rounded transition ${
                    viewMode === "sandbox"
                      ? "bg-slate-900 border border-slate-800 text-cyan-400 font-bold"
                      : "text-slate-500 hover:text-slate-400"
                  }`}
                >
                  Sandbox Studio
                </button>
              </div>
              <span
                className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                  fleet.hp <= 0
                    ? "bg-slate-950 border-slate-800 text-slate-500 animate-none"
                    : fleet.isAlert
                      ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse font-bold"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                }`}
              >
                {fleet.hp <= 0 ? "DEADLOCK" : fleet.isAlert ? "Safety Halt" : "Active"}
              </span>
            </div>

            {/* Render Visual twin or Cloud topology flowchart */}
            {viewMode === "physical" ? (
              <PhysicalTwinVisualizer
                distance={fleet.distance}
                currentX={fleet.currentX}
                robotPosition={fleet.robotPosition}
                isAlert={fleet.isAlert}
                hp={fleet.hp}
                battery={fleet.battery}
                velocity={fleet.velocity}
                temperature={fleet.temperature}
                latencyMs={
                  fleet.response
                    ? computeActualLatencyMs(fleet.response.latency_ms, fleet.jitterEnabled)
                    : fleet.jitterEnabled
                      ? JITTER_DELAY_MS
                      : DEFAULT_DISPLAY_LATENCY_MS
                }
              />
            ) : viewMode === "topology" ? (
              <CloudTopologyFlowchart isAlert={fleet.isAlert} />
            ) : (
              <SandboxPanel
                routerPrompt={fleet.routerPrompt}
                setRouterPrompt={fleet.setRouterPrompt}
                safetyRules={fleet.safetyRules}
                setSafetyRules={fleet.setSafetyRules}
                executionSchema={fleet.executionSchema}
                setExecutionSchema={fleet.setExecutionSchema}
              />
            )}
          </div>

          {/* C2D Motor Action Indicator */}
          <div className="border border-slate-900 bg-slate-950 rounded-xl p-4 mt-4">
            <h3 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold mb-3">Gateway Motor Actions (C2D Output)</h3>
            {fleet.response ? (
              <div className="space-y-2">
                {fleet.response.final_action.map((action, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between text-sm px-3.5 py-2 rounded-lg border font-mono ${
                      fleet.isAlert
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
                      <span className="font-bold uppercase">{action.action}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {Object.entries(action)
                        .filter(([k]) => k !== "action")
                        .map(([k, v]) => `${k}:${v}`)
                        .join(" | ") || "Immediate Safety Stop"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-600 text-center py-4 italic">
                Awaiting telemetry evaluation...
              </div>
            )}
          </div>
        </div>

        {/* Middle Column: 3-Agent Flow Diagram (Span 4) */}
        <div className="lg:col-span-4 border border-slate-900 bg-slate-900/10 rounded-2xl p-5 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div>
            <h2 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold mb-6">
              Multi-Agent Orchestration Blueprint
            </h2>

            <AgentOrchestratorFlow response={fleet.response} triggerDist={fleet.tenantTriggerDist} />
          </div>

          {/* Quick explanations */}
          <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-4 mt-6 leading-relaxed">
            <span className="font-bold text-slate-400 uppercase">Verification Rule:</span> If Agent 2 triggers{" "}
            <span className="text-red-400">BLOCKED</span>, the pipeline immediately short-circuits. Agent 3 shows{" "}
            <span className="text-slate-600 font-bold">SKIPPED</span> to save LLM tokens and guarantee low-latency safety overrides.
          </div>
        </div>

        {/* Right Column: Console / Raw Data Logs & Cloud Metrics (Span 4) */}
        <div className="lg:col-span-4 border border-slate-900 bg-slate-900/10 rounded-2xl p-5 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div className="flex flex-col h-full justify-between space-y-5">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">Telemetry Audit Logs</h2>

                {/* Latency Gauge */}
                {fleet.response && (
                  <div className="flex items-center space-x-1.5 font-mono text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    <span>Latency:</span>
                    <span
                      className={`font-bold ${
                        computeActualLatencyMs(fleet.response.latency_ms, fleet.jitterEnabled) > LATENCY_HIGH_THRESHOLD_MS
                          ? "text-red-400"
                          : "text-cyan-400"
                      }`}
                    >
                      {computeActualLatencyMs(fleet.response.latency_ms, fleet.jitterEnabled)} ms
                    </span>
                  </div>
                )}
              </div>

              {/* Infrastructure Telemetry Panel */}
              <InfraTelemetryPanel metrics={fleet.response?.cloud_metrics} />

              {/* Black Terminal Code Console */}
              <AuditTerminalConsole response={fleet.response} logs={fleet.collisionLogs} />
            </div>

            {/* Platform statistics */}
            <div className="border border-slate-900 bg-slate-950 rounded-xl p-3 flex justify-around text-center text-xs font-mono">
              <div>
                <div className="text-slate-500 text-[10px] uppercase">Latency</div>
                <div className="text-cyan-400 font-bold text-sm mt-0.5">
                  {fleet.response ? `${computeActualLatencyMs(fleet.response.latency_ms, fleet.jitterEnabled)}ms` : "--"}
                </div>
              </div>
              <div className="border-r border-slate-900"></div>
              <div>
                <div className="text-slate-500 text-[10px] uppercase">Pipeline Status</div>
                <div
                  className={`font-bold text-sm mt-0.5 uppercase ${
                    fleet.hp <= 0
                      ? "text-slate-500"
                      : fleet.isAlert
                        ? "text-red-400"
                        : fleet.response
                          ? "text-emerald-400"
                          : "text-slate-600"
                  }`}
                >
                  {fleet.hp <= 0 ? "Deadlock" : fleet.isAlert ? "Blocked" : fleet.response ? "Passed" : "Idle"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}