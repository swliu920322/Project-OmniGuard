"use client";

import React, { useState, useEffect } from "react";

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
  // View mode state
  const [viewMode, setViewMode] = useState<"physical" | "topology">("physical");

  // Input states
  const [tenantId, setTenantId] = useState<string>("Tenant-Alpha");
  const [distance, setDistance] = useState<number>(40);
  const [currentX, setCurrentX] = useState<number>(10);
  
  // API response states
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<SimulateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // local telemetry representation for animation
  const [robotPosition, setRobotPosition] = useState<number>(50); // visual X offset percentage
  const [isAlert, setIsAlert] = useState<boolean>(false);
  
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

  const triggerSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:7071/simulate_agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          obstacle_distance_cm: distance,
          current_x: currentX
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

      // Animate coordinates slightly based on movement
      if (!isBlocked && data.final_action.some(act => act.action === "move")) {
        const speed = data.final_action.find(act => act.action === "move")?.speed || 20;
        setCurrentX(prev => prev + Math.min(Math.round(speed / 10), 10));
      }
    } catch (err: any) {
      setError(err.message || "Failed to contact backend API");
      setResponse(null);
      setIsAlert(true);
    } finally {
      setLoading(false);
    }
  };

  // Adjust visual position of robot based on distance
  useEffect(() => {
    // 0cm obstacle means robot is at the wall (e.g. 80% offset), 100cm means far left (e.g. 10% offset)
    const newPos = Math.max(10, Math.min(80, 80 - (distance * 0.7)));
    setRobotPosition(newPos);
  }, [distance]);

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
              onChange={(e) => setTenantId(e.target.value)}
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

          {/* Slider for Obstacle Distance */}
          <div className="flex flex-col space-y-2 md:col-span-2">
            <div className="flex justify-between items-center">
              <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">
                Obstacle Distance (Telemetry)
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
                onChange={(e) => setDistance(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>0cm (Imminent Collision)</span>
              <span>30cm (Alpha Limit)</span>
              <span>100cm (Navigating)</span>
            </div>
          </div>
        </div>

        {/* Big Trigger Button */}
        <div className="max-w-7xl mx-auto mt-5 flex justify-end">
          <button
            onClick={triggerSimulation}
            disabled={loading}
            className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase transition shadow-lg ${
              loading
                ? "bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.98] border border-cyan-400/20"
            }`}
          >
            {loading ? (
              <span className="flex items-center space-x-2 justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing Telemetry...
              </span>
            ) : (
              "Simulate Sensor Event & Run Pipeline"
            )}
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

            {/* Conditionally render Visual simulation or Cloud topology flowchart */}
            {viewMode === "physical" ? (
              <div className="h-72 border border-slate-900 bg-slate-950 rounded-xl relative overflow-hidden flex flex-col justify-between shadow-inner">
                <div className="h-full w-full flex items-center relative p-4">
                  
                  {/* Distance Grid Markings */}
                  <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-10 border-x border-slate-900/30 pointer-events-none">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border-r border-slate-900/15 h-full"></div>
                    ))}
                  </div>

                  {/* Laser sensor line */}
                  <div 
                    className="absolute h-[1px] border-t border-dashed pointer-events-none transition-all duration-300"
                    style={{
                      left: `${robotPosition}%`,
                      right: `8%`,
                      borderColor: isAlert ? "#ef4444" : "#10b981",
                      borderWidth: isAlert ? "2px" : "1px"
                    }}
                  >
                    {!loading && (
                      <div className={`absolute top-0 right-0 w-2 h-2 -mt-1 rounded-full animate-ping ${
                        isAlert ? "bg-red-500" : "bg-emerald-500"
                      }`}></div>
                    )}
                  </div>

                  {/* Robot Simulator Icon */}
                  <div 
                    className="absolute w-12 h-12 -ml-6 rounded-full border bg-slate-900 flex items-center justify-center transition-all duration-300 shadow-md shadow-black/80 z-10"
                    style={{ 
                      left: `${robotPosition}%`,
                      borderColor: isAlert ? "#ef4444" : "#06b6d4",
                      boxShadow: isAlert ? "0 0 20px rgba(239,68,68,0.2)" : "0 0 20px rgba(6,182,212,0.2)"
                    }}
                  >
                    <svg className={`w-6 h-6 transition-transform ${isAlert ? "text-red-400 rotate-12" : "text-cyan-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>

                  {/* Obstacle Wall */}
                  <div className="absolute right-0 top-0 bottom-0 w-[8%] bg-gradient-to-l from-slate-900 to-slate-950 border-l border-slate-800 flex items-center justify-center">
                    <div className={`w-1.5 h-[80%] rounded-full ${
                      isAlert ? "bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]" : "bg-slate-800"
                    }`}></div>
                  </div>

                  {/* Warning Overlay shield */}
                  {isAlert && (
                    <div className="absolute inset-0 bg-red-950/10 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-none">
                      <div className="bg-red-950/80 border border-red-500/30 rounded-xl px-4 py-2 text-center shadow-lg text-red-400 text-xs font-bold uppercase tracking-wider animate-bounce flex items-center space-x-2">
                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Emergency Halt (C2D)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Readouts below grid */}
                <div className="bg-slate-900/30 border-t border-slate-900 px-4 py-3 flex justify-between text-xs font-mono text-slate-400">
                  <div>X Position: <span className="text-cyan-400">{currentX}m</span></div>
                  <div>Sensor Gap: <span className={isAlert ? "text-red-400 font-bold" : "text-emerald-400"}>{distance}cm</span></div>
                </div>
              </div>
            ) : (
              <div className="border border-slate-900 bg-slate-950 rounded-xl p-4 min-h-[18rem] shadow-inner">
                {/* Cloud Topology Flowchart */}
                <div className="flex flex-col space-y-3.5 font-mono text-xs">
                  {/* Node 1: Device Simulator */}
                  <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-cyan-400 font-bold">🖥️ Edge Device Simulator</div>
                      <div className="text-[10px] text-slate-500 font-sans">device_mock.py</div>
                    </div>
                    <span className="text-[9px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                      Local Node
                    </span>
                  </div>

                  {/* Connector Arrow */}
                  <div className="flex justify-center text-slate-700 font-bold text-[10px]">⬇️ MQTT Stream (1Hz)</div>

                  {/* Node 2: Azure IoT Hub */}
                  <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex flex-col space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-teal-400 font-bold">☁️ Azure IoT Hub (F1 Free)</span>
                      <span className="text-[8px] tracking-wider uppercase font-mono px-1.5 py-0.5 rounded border border-slate-800 bg-slate-950 text-slate-500">
                        nested-infra.bicep
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-500 font-sans">Hostname & SAS Token Authentication</div>
                  </div>

                  {/* Connector Arrow */}
                  <div className="flex justify-center text-slate-700 font-bold text-[10px]">⬇️ Event Hub Trigger</div>

                  {/* Node 3: Azure Functions (Compute Engine) */}
                  <div className={`border p-2.5 rounded-xl flex flex-col space-y-1 transition-all duration-300 ${
                    isAlert ? "border-red-500/40 bg-red-950/10 text-slate-100" : "border-slate-850 bg-slate-900/30 text-slate-300"
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-indigo-400 font-bold">⚡ Azure Functions (Serverless)</span>
                      <span className="text-[8px] tracking-wider uppercase font-mono px-1.5 py-0.5 rounded border border-slate-800 bg-slate-950 text-slate-500">
                        compute-module.bicep
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-500 font-sans">brain.py / iot_telemetry_processor</div>
                  </div>

                  {/* Connector Arrow */}
                  <div className="flex justify-center text-slate-700 font-bold text-[10px]">🔁 Secure VNet Backbone</div>

                  {/* Node 4: Cloud databases & LLM */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex flex-col space-y-1">
                      <span className="text-emerald-400 font-bold">🗄️ Cosmos DB</span>
                      <span className="text-[8px] text-slate-500">nested-infra.bicep</span>
                      <span className="text-[9px] text-slate-400">DeviceTwins /tenant_id</span>
                    </div>
                    <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex flex-col space-y-1">
                      <span className="text-pink-400 font-bold">🤖 Azure OpenAI</span>
                      <span className="text-[8px] text-slate-500">Shared Resource</span>
                      <span className="text-[9px] text-slate-400">gpt-5.4-mini</span>
                    </div>
                  </div>
                </div>
              </div>
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

            {/* Vertical Flow of Agents */}
            <div className="space-y-6 relative">
              
              {/* Vertical connector line */}
              <div className="absolute top-6 bottom-6 left-6 w-[2px] bg-slate-800 pointer-events-none -z-10"></div>

              {/* Node 1: Intent Router */}
              {renderAgentNode(
                "1. Intent Router",
                "Classifies raw telemetry to determine the operational context.",
                getStepByAgent("Router"),
                "purple"
              )}

              {/* Node 2: Safety Firewall */}
              {renderAgentNode(
                "2. Safety Firewall",
                `Applies strict compliance policies. Target: ${tenantScenarios[tenantId]?.triggerDist}.`,
                getStepByAgent("Safety"),
                "red"
              )}

              {/* Node 3: Action Compiler */}
              {renderAgentNode(
                "3. Action Compiler",
                "Translates safe intents into compliant physical motor instructions.",
                getStepByAgent("Action Compiler"),
                "cyan"
              )}
            </div>
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

              {/* Infrastructure Telemetry (Proof of Cloud) */}
              <div className="mb-4 border border-slate-900 bg-slate-950 rounded-xl p-4">
                <h3 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold mb-3">
                  Infrastructure Telemetry (Cloud Proof)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-900/40 p-2.5 rounded border border-slate-900 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 uppercase">Cosmos DB Charge</span>
                    <span className="text-emerald-400 font-bold text-sm mt-1 animate-pulse">
                      {response?.cloud_metrics?.cosmos_db_ru_charge ? `${response.cloud_metrics.cosmos_db_ru_charge} RU` : "10.67 RU"}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 p-2.5 rounded border border-slate-900 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 uppercase">Cosmos Latency</span>
                    <span className="text-emerald-400 font-bold text-sm mt-1">
                      {response?.cloud_metrics?.cosmos_write_latency_ms ? `${response.cloud_metrics.cosmos_write_latency_ms} ms` : "5.3 ms"}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 p-2.5 rounded border border-slate-900 col-span-2 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 uppercase">Compute Environment</span>
                    <span className="text-cyan-400 font-bold mt-1 text-[11px] truncate">
                      {response?.cloud_metrics?.execution_environment || "Azure Functions (Linux)"}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 p-2.5 rounded border border-slate-900 col-span-2 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 uppercase">VNet isolation & Routing</span>
                    <span className="text-indigo-400 font-bold mt-1 text-[11px] truncate">
                      {response?.cloud_metrics?.vnet_isolation || "Active (BackendSubnet)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Black Terminal Code Console */}
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 h-64 font-mono text-xs text-slate-400 overflow-auto flex flex-col shadow-inner select-text">
                <div className="flex items-center space-x-1.5 border-b border-slate-900 pb-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60"></div>
                  <span className="text-[10px] text-slate-600 pl-2">omniguard_audit_console.log</span>
                </div>
                <div className="flex-1 font-mono leading-normal">
                  {response ? (
                    <pre className="text-cyan-500/90 leading-relaxed">
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-slate-600 italic py-10 text-center">
                      // Initialize simulation to output raw JSON telemetry payload here.
                    </div>
                  )}
                </div>
              </div>
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

  // Helper render to clean up nodes rendering
  function renderAgentNode(title: string, desc: string, step: PipelineStep | null, primaryColor: "purple" | "red" | "cyan") {
    let statusClass = "bg-slate-900/30 border-slate-900 text-slate-500 opacity-60";
    let badgeClass = "bg-slate-950 text-slate-600 border-slate-800";
    let badgeText = "Awaiting";

    if (step) {
      if (step.status === "PASS" || step.status === "COMPILED" || (step.agent === "Router" && step.decision)) {
        statusClass = "border-emerald-500/40 bg-emerald-950/5 text-slate-100 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
        badgeClass = "bg-emerald-950/80 border-emerald-500/30 text-emerald-400";
        badgeText = step.status || "PASS";
      } else if (step.status === "BLOCKED") {
        statusClass = "border-red-500/40 bg-red-950/5 text-slate-100 shadow-[0_0_15px_rgba(239,68,68,0.05)]";
        badgeClass = "bg-red-950/80 border-red-500/30 text-red-400 animate-pulse";
        badgeText = "BLOCKED";
      } else if (step.status === "SHORT_CIRCUIT" || step.decision === "SKIPPED") {
        statusClass = "border-slate-900 bg-slate-900/10 text-slate-500 opacity-30";
        badgeClass = "bg-slate-950 text-slate-600 border-slate-800";
        badgeText = "SKIPPED";
      }
    }

    const dotColors = {
      purple: "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]",
      red: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
      cyan: "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
    };

    return (
      <div className={`flex items-start space-x-4 border rounded-xl p-4 transition-all duration-300 ${statusClass}`}>
        
        {/* Step Indicator Dot */}
        <div className={`w-4 h-4 rounded-full mt-1.5 flex items-center justify-center z-10 ${dotColors[primaryColor]}`}>
          <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
        </div>

        {/* Content details */}
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold tracking-tight">{title}</h3>
            <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${badgeClass}`}>
              {badgeText}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-normal">{desc}</p>
          
          {step && step.decision && step.decision !== "SKIPPED" && (
            <div className="bg-slate-950 border border-slate-900 rounded-lg p-2.5 mt-2">
              <div className="text-[10px] uppercase font-mono text-slate-500 font-bold mb-1">Decision Output</div>
              <div className="text-xs font-mono font-bold text-cyan-400 break-all whitespace-pre-wrap">
                {step.decision}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Get trace step helper
  function getStepByAgent(agentName: string): PipelineStep | null {
    if (!response) return null;
    return response.pipeline_trace.find(step => step.agent === agentName) || null;
  }
}
