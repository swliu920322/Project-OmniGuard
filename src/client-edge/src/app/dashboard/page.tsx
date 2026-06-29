"use client";

import React, { useState, useEffect, useRef } from "react";
import PhysicalTwinVisualizer from "./components/PhysicalTwinVisualizer";
import CloudTopologyFlowchart from "./components/CloudTopologyFlowchart";
import AgentOrchestratorFlow from "./components/AgentOrchestratorFlow";
import InfraTelemetryPanel from "./components/InfraTelemetryPanel";
import AuditTerminalConsole from "./components/AuditTerminalConsole";

interface PipelineStep {
  agent: string;
  decision: string;
  status?: "PASS" | "BLOCKED" | "SHORT_CIRCUIT" | "COMPILED";
}

interface SimulateResponse {
  latency_ms: number;
  final_action: Array<Record<string, any>>;
  pipeline_trace: PipelineStep[];
  cloud_metrics?: {
    cosmos_db_ru_charge: number;
    cosmos_write_latency_ms: number;
    execution_environment: string;
    vnet_isolation: string;
    iot_hub_routing: string;
  };
}

export default function FleetDashboard() {
  // Hydration control to prevent Server-Client mismatch issues
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // View mode state
  const [viewMode, setViewMode] = useState<"physical" | "topology">("physical");

  // Autopilot navigation loop state
  const [autopilot, setAutopilot] = useState<boolean>(false);

  // Input states
  const [tenantId, setTenantId] = useState<string>("Tenant-Alpha");
  const [distance, setDistance] = useState<number>(80); // Start farther away for dynamic navigations
  const [currentX, setCurrentX] = useState<number>(0);
  const [targetSpeed, setTargetSpeed] = useState<number>(50); // Configurable target speed
  
  // API response states
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<SimulateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // local telemetry representation for animation
  const [robotPosition, setRobotPosition] = useState<number>(50); // visual X offset percentage
  const [isAlert, setIsAlert] = useState<boolean>(false);

  // Use refs to store state values for the autopilot interval to avoid stale closure issues
  const distanceRef = useRef(distance);
  const currentXRef = useRef(currentX);
  const tenantIdRef = useRef(tenantId);
  const targetSpeedRef = useRef(targetSpeed);
  const autopilotRef = useRef(autopilot);

  useEffect(() => { distanceRef.current = distance; }, [distance]);
  useEffect(() => { currentXRef.current = currentX; }, [currentX]);
  useEffect(() => { tenantIdRef.current = tenantId; }, [tenantId]);
  useEffect(() => { targetSpeedRef.current = targetSpeed; }, [targetSpeed]);
  useEffect(() => { autopilotRef.current = autopilot; }, [autopilot]);
  
  // Dynamic config descriptors (frontend helper only, no logic calculated here)
  const tenantScenarios: Record<string, { name: string; desc: string; triggerDist: string }> = {
    "Tenant-Alpha": {
      name: "Data Center Patrol",
      desc: "Critical fire/obstacle detection. Block action below 30cm limit.",
      triggerDist: "30cm"
    },
    "Tenant-Beta": {
      name: "Hospital Delivery",
      desc: "Emergency safety stop. Force block on human detection.",
      triggerDist: "human detected / critical block"
    }
  };

  // Run a single simulation step (used by autopilot and manual trigger)
  // Returns true if autopilot should continue, false if it should stop
  const runAutopilotStep = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate_agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tenant_id: tenantIdRef.current,
          obstacle_distance_cm: distanceRef.current,
          current_x: currentXRef.current,
          target_speed: targetSpeedRef.current
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned error status: ${res.status}`);
      }

      const data: SimulateResponse = await res.json();
      setResponse(data);
      
      // Update visual representation based on response
      const isBlocked = data.pipeline_trace.some(step => step.status === "BLOCKED");
      setIsAlert(isBlocked);

      // If Safety block is triggered, force shut down Autopilot loop
      if (isBlocked || data.final_action.some(act => act.action === "stop")) {
        setAutopilot(false);
        return false;
      }

      // Animate coordinates dynamically based on movement response
      const moveAction = data.final_action.find(act => act.action === "move");
      if (moveAction) {
        const speed = moveAction.speed || 20;
        
        // Translate speed into physical movement changes
        const dx = Math.max(1, Math.round(speed / 10)); // increment X
        const dd = Math.max(2, Math.round(speed / 5));  // decrease gap to obstacle
        
        setCurrentX(prev => prev + dx);
        setDistance(prev => Math.max(0, prev - dd));
        return true;
      } else {
        // Stop autopilot if no movement command returned
        setAutopilot(false);
        return false;
      }
    } catch (err: any) {
      setError(err.message || "Failed to contact backend API");
      setResponse(null);
      setIsAlert(true);
      setAutopilot(false);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Single-Step Manual evaluation trigger
  const triggerSimulation = async () => {
    // If currently running auto patrol, stop it first
    if (autopilot) {
      setAutopilot(false);
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate_agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          obstacle_distance_cm: distance,
          current_x: currentX,
          target_speed: targetSpeed
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned error status: ${res.status}`);
      }

      const data: SimulateResponse = await res.json();
      setResponse(data);
      
      const isBlocked = data.pipeline_trace.some(step => step.status === "BLOCKED");
      setIsAlert(isBlocked);

      if (!isBlocked && data.final_action.some(act => act.action === "move")) {
        const speed = data.final_action.find(act => act.action === "move")?.speed || 20;
        setCurrentX(prev => prev + Math.max(Math.round(speed / 10), 1));
        setDistance(prev => Math.max(0, prev - Math.max(Math.round(speed / 5), 2)));
      }
    } catch (err: any) {
      setError(err.message || "Failed to contact backend API");
      setResponse(null);
      setIsAlert(true);
    } finally {
      setLoading(false);
    }
  };

  // Autopilot loop trigger using sequential recursive setTimeout to prevent network request pile-up
  useEffect(() => {
    if (!autopilot) return;

    let active = true;
    let timerId: NodeJS.Timeout | null = null;

    const executeCycle = async () => {
      if (!active) return;
      const shouldContinue = await runAutopilotStep();
      if (active && shouldContinue && autopilotRef.current) {
        timerId = setTimeout(executeCycle, 800); // Schedule next request 800ms AFTER current one fully completes
      }
    };

    executeCycle();

    return () => {
      active = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [autopilot]);

  // Adjust visual position of robot based on distance
  useEffect(() => {
    const newPos = Math.max(10, Math.min(80, 80 - (distance * 0.7)));
    setRobotPosition(newPos);
  }, [distance]);

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
            Digital Twin v2.0
          </span>
        </div>
        <div className="text-xs font-mono text-slate-500">
          Sensor Refresh Interval: <span className="text-cyan-400 font-bold">1Hz</span> (Real-Time MQTT Loop)
        </div>
      </header>

      {/* Control / Config Section */}
      <section className="bg-slate-950 px-6 py-6 border-b border-slate-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-900/25 border border-slate-900 p-5 rounded-2xl backdrop-blur-sm shadow-inner">
          
          {/* Dropdown Selection */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">Active Tenant</label>
            <select
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setDistance(80); // Reset distance on tenant change to allow room to drive
                setAutopilot(false);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none transition"
            >
              <option value="Tenant-Alpha">Tenant-Alpha (Data Center)</option>
              <option value="Tenant-Beta">Tenant-Beta (Hospital Delivery)</option>
            </select>
            <p className="text-slate-500 text-xs italic">
              {tenantScenarios[tenantId]?.desc}
            </p>
          </div>

          {/* Current X Position (Readout/Modify) */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">Current X Coordinates</label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={currentX}
                onChange={(e) => setCurrentX(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm w-full focus:border-cyan-500 focus:outline-none transition"
              />
              <span className="text-xs text-slate-500 font-mono">meters</span>
            </div>
            <p className="text-slate-500 text-xs italic">
              Represents current motor encoder localization telemetry.
            </p>
          </div>

          {/* Slider for Target Speed Limit */}
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">
                Max Speed Cap
              </label>
              <span className="text-sm font-mono font-bold text-cyan-400">
                {targetSpeed} cm/s
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="10"
                max="100"
                value={targetSpeed}
                onChange={(e) => {
                  setTargetSpeed(Number(e.target.value));
                }}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>10cm/s (Slow)</span>
              <span>100cm/s (Fast)</span>
            </div>
          </div>

          {/* Slider for Obstacle Distance */}
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">
                Obstacle Distance
              </label>
              <span className="text-sm font-mono font-bold text-cyan-400">
                {distance} cm
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max="100"
                value={distance}
                onChange={(e) => {
                  setDistance(Number(e.target.value));
                  if (autopilot) setAutopilot(false); // pause autopilot if manual adjust
                }}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>0cm (Imminent)</span>
              <span>100cm (Far)</span>
            </div>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="max-w-7xl mx-auto mt-5 flex justify-end space-x-4">
          <button
            onClick={() => setAutopilot(prev => !prev)}
            className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase transition shadow-lg ${
              autopilot
                ? "bg-red-500 hover:bg-red-650 text-white animate-pulse border border-red-400/50 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                : "bg-slate-900 border border-slate-800 text-cyan-400 hover:border-cyan-500/30 hover:text-cyan-300"
            }`}
          >
            {autopilot ? "🛑 Stop Autopilot" : "🚀 Start Autopilot"}
          </button>

          <button
            onClick={triggerSimulation}
            disabled={loading || autopilot}
            className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase transition shadow-lg ${
              loading || autopilot
                ? "bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.98] border border-cyan-400/20"
            }`}
          >
            {loading ? "Processing..." : "Manual Single-Step"}
          </button>
        </div>
      </section>

      {/* Error Alert Bar */}
      {error && (
        <div className="bg-red-950/20 border-y border-red-900/50 py-3 px-6 text-sm text-red-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-base font-bold">⚠️ Connection Error:</span>
            <span>{error}. Verify local Function host is running on port 7071.</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 font-bold">✕</button>
        </div>
      )}

      {/* Main 3-Column Dashboard Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Digital Twin / Cloud Topology Visualizer (Span 4) */}
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
              </div>
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                isAlert 
                  ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse" 
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              }`}>
                {isAlert ? "Safety Override" : "Normal"}
              </span>
            </div>

            {/* Render Visual twin or Cloud topology flowchart */}
            {viewMode === "physical" ? (
              <PhysicalTwinVisualizer
                distance={distance}
                currentX={currentX}
                robotPosition={robotPosition}
                isAlert={isAlert}
              />
            ) : (
              <CloudTopologyFlowchart isAlert={isAlert} />
            )}
          </div>

          {/* C2D Motor Action Indicator */}
          <div className="border border-slate-900 bg-slate-950 rounded-xl p-4 mt-4">
            <h3 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold mb-3">Gateway Motor Actions (C2D Output)</h3>
            {response ? (
              <div className="space-y-2">
                {response.final_action.map((action, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between text-sm px-3.5 py-2 rounded-lg border font-mono ${
                      isAlert 
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

            <AgentOrchestratorFlow
              response={response}
              triggerDist={tenantScenarios[tenantId]?.triggerDist || ""}
            />
          </div>

          {/* Quick explanations */}
          <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-4 mt-6 leading-relaxed">
            <span className="font-bold text-slate-400 uppercase">Verification Rule:</span> If Agent 2 triggers <span className="text-red-400">BLOCKED</span>, the pipeline immediately short-circuits. Agent 3 shows <span className="text-slate-600 font-bold">SKIPPED</span> to save LLM tokens and guarantee low-latency safety overrides.
          </div>
        </div>

        {/* Right Column: Console / Raw Data Logs & Cloud Metrics (Span 4) */}
        <div className="lg:col-span-4 border border-slate-900 bg-slate-900/10 rounded-2xl p-5 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div className="flex flex-col h-full justify-between space-y-5">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">Telemetry Audit Logs</h2>
                
                {/* Latency Gauge */}
                {response && (
                  <div className="flex items-center space-x-1.5 font-mono text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    <span>Latency:</span>
                    <span className={`font-bold ${
                      response.latency_ms > 2000 ? "text-amber-400" : "text-cyan-400"
                    }`}>
                      {response.latency_ms} ms
                    </span>
                  </div>
                )}
              </div>

              {/* Infrastructure Telemetry Panel */}
              <InfraTelemetryPanel metrics={response?.cloud_metrics} />

              {/* Black Terminal Code Console */}
              <AuditTerminalConsole response={response} />
            </div>

            {/* Platform statistics */}
            <div className="border border-slate-900 bg-slate-950 rounded-xl p-3 flex justify-around text-center text-xs font-mono">
              <div>
                <div className="text-slate-500 text-[10px] uppercase">Latency</div>
                <div className="text-cyan-400 font-bold text-sm mt-0.5">
                  {response ? `${response.latency_ms}ms` : "--"}
                </div>
              </div>
              <div className="border-r border-slate-900"></div>
              <div>
                <div className="text-slate-500 text-[10px] uppercase">Pipeline Status</div>
                <div className={`font-bold text-sm mt-0.5 uppercase ${
                  isAlert ? "text-red-400" : response ? "text-emerald-400" : "text-slate-600"
                }`}>
                  {isAlert ? "Blocked" : response ? "Passed" : "Idle"}
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
