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

  // View mode state (physical, topology, sandbox)
  const [viewMode, setViewMode] = useState<"physical" | "topology" | "sandbox">("physical");

  // Autopilot navigation loop state
  const [autopilot, setAutopilot] = useState<boolean>(false);

  // Core state variables (Blueprint 005)
  const [hp, setHp] = useState<number>(100);
  const [battery, setBattery] = useState<number>(100);
  const [velocity, setVelocity] = useState<number>(0.5); // m/s
  const [temperature, setTemperature] = useState<number>(40); // °C
  const [jitterEnabled, setJitterEnabled] = useState<boolean>(false);
  const [collisionLogs, setCollisionLogs] = useState<string[]>([]);

  // Input states
  const [tenantId, setTenantId] = useState<string>("Tenant-Alpha");
  const [distance, setDistance] = useState<number>(80); // cm
  const [currentX, setCurrentX] = useState<number>(0);
  const [targetSpeed, setTargetSpeed] = useState<number>(50); // cm/s

  // Prompt configuration overrides (Blueprint 006)
  const [routerPrompt, setRouterPrompt] = useState<string>("");
  const [safetyRules, setSafetyRules] = useState<string>("");
  const [executionSchema, setExecutionSchema] = useState<string>("");

  // Default configs for prompt fields initialization
  const defaultConfigs: Record<string, { router: string; safety: string; schema: string }> = {
    "Tenant-Alpha": {
      router: "Classify telemetry into: [CRITICAL_OBSTACLE, NORMAL_NAV, SENSOR_ERROR]. Return ONLY the classification string.",
      safety: "Strict Rule: Actions MUST NOT include 'spray_water' or 'fast_forward'. Maintain 30cm minimum distance.",
      schema: "[{'action': 'stop'|'turn'|'move', 'degree': int, 'speed': int}]"
    },
    "Tenant-Beta": {
      router: "Classify telemetry into: [HUMAN_DETECTED, STATIC_OBSTACLE, EMERGENCY]. Return ONLY the classification string.",
      safety: "Strict Rule: If HUMAN_DETECTED, the only allowed action is 'stop'. No bypassing.",
      schema: "[{'action': 'stop'|'backward'|'voice_alert', 'speed': int}]"
    }
  };

  useEffect(() => {
    const defaults = defaultConfigs[tenantId];
    if (defaults) {
      setRouterPrompt(defaults.router);
      setSafetyRules(defaults.safety);
      setExecutionSchema(defaults.schema);
    }
  }, [tenantId]);

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
  
  const hpRef = useRef(hp);
  const batteryRef = useRef(battery);
  const velocityRef = useRef(velocity);
  const temperatureRef = useRef(temperature);
  const jitterEnabledRef = useRef(jitterEnabled);
  const routerPromptRef = useRef(routerPrompt);
  const safetyRulesRef = useRef(safetyRules);
  const executionSchemaRef = useRef(executionSchema);

  useEffect(() => { distanceRef.current = distance; }, [distance]);
  useEffect(() => { currentXRef.current = currentX; }, [currentX]);
  useEffect(() => { tenantIdRef.current = tenantId; }, [tenantId]);
  useEffect(() => { targetSpeedRef.current = targetSpeed; }, [targetSpeed]);
  useEffect(() => { autopilotRef.current = autopilot; }, [autopilot]);
  
  useEffect(() => { hpRef.current = hp; }, [hp]);
  useEffect(() => { batteryRef.current = battery; }, [battery]);
  useEffect(() => { velocityRef.current = velocity; }, [velocity]);
  useEffect(() => { temperatureRef.current = temperature; }, [temperature]);
  useEffect(() => { jitterEnabledRef.current = jitterEnabled; }, [jitterEnabled]);
  useEffect(() => { routerPromptRef.current = routerPrompt; }, [routerPrompt]);
  useEffect(() => { safetyRulesRef.current = safetyRules; }, [safetyRules]);
  useEffect(() => { executionSchemaRef.current = executionSchema; }, [executionSchema]);

  // Dynamic config descriptors
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
      // Simulate network latency spike if jitter is enabled
      if (jitterEnabledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      const res = await fetch("/api/simulate_agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tenant_id: tenantIdRef.current,
          obstacle_distance_cm: distanceRef.current,
          current_x: currentXRef.current,
          target_speed: targetSpeedRef.current,
          velocity: velocityRef.current,
          hp: hpRef.current,
          battery: batteryRef.current,
          temperature: temperatureRef.current,
          override_config: {
            agent_router_prompt: routerPromptRef.current,
            agent_safety_rules: safetyRulesRef.current,
            agent_execution_schema: executionSchemaRef.current
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned error status: ${res.status}`);
      }

      const data: SimulateResponse = await res.json();
      setResponse(data);
      
      const actualLatencyMs = data.latency_ms + (jitterEnabledRef.current ? 2500 : 0);
      const isBlocked = data.pipeline_trace.some(step => step.status === "BLOCKED");
      setIsAlert(isBlocked);

      // Perform physics update (Blueprint 005)
      const t = actualLatencyMs / 1000;
      const slidingDist = velocityRef.current * t * 100; // in cm
      const moveAction = data.final_action.find(act => act.action === "move");
      
      let newHp = hpRef.current;
      let newBattery = batteryRef.current;
      let newTemp = temperatureRef.current;
      let newVelocity = velocityRef.current;
      let isCollided = false;

      // 1. Check for collision & update position/speed
      if (slidingDist > distanceRef.current && distanceRef.current > 0) {
        newHp = Math.max(0, newHp - 50);
        isCollided = true;
        setHp(newHp);
        
        // Physical impact: vehicle travels the remaining distance, hits the wall, and stops
        setCurrentX(prev => Number((prev + distanceRef.current / 100).toFixed(2)));
        setDistance(0);
        setVelocity(0);
        newVelocity = 0;
      } else {
        // Safe slide during latency period
        setCurrentX(prev => Number((prev + slidingDist / 100).toFixed(2)));
        setDistance(prev => Math.max(0, Number((prev - slidingDist).toFixed(1))));
        
        // Apply new command's velocity for the next leg
        if (moveAction) {
          const speed = moveAction.speed || 50; // cm/s
          newVelocity = speed / 100; // m/s
          setVelocity(newVelocity);
        } else {
          newVelocity = 0;
          setVelocity(0);
        }
      }

      // 2. Battery consumption logic
      let batteryDrain = 0.6; // base rate
      if (data.final_action.some(act => act.action === "stop" || act.action === "emergency_halt")) {
        batteryDrain += 2.0;
      }
      if (data.final_action.some(act => act.action === "turn" || act.action === "reverse")) {
        batteryDrain += 1.2;
      }
      
      // Overheating drain
      if (newTemp > 60) {
        const speed = moveAction ? (moveAction.speed || 50) : 0;
        if (velocityRef.current > 0.5 || speed > 20) {
          batteryDrain += 3.0; // Rapid drain due to high load when overheated
        } else {
          newTemp = Math.max(40, newTemp - 4);
          setTemperature(newTemp);
        }
      } else {
        // Temperature fluctuations
        if (data.final_action.some(act => act.action === "move" && (act.speed || 50) > 60)) {
          newTemp = Math.min(100, newTemp + 3);
          setTemperature(newTemp);
        } else {
          newTemp = Math.max(40, newTemp - 1);
          setTemperature(newTemp);
        }
      }

      newBattery = Math.max(0, newBattery - batteryDrain);
      setBattery(newBattery);

      // 3. Step Logging (Detailed feedback on every tick)
      const logsToAppend: string[] = [];
      const actionDesc = moveAction ? `MOVE (${moveAction.speed || 50}cm/s)` : data.final_action[0]?.action?.toUpperCase() || "HALT";
      
      logsToAppend.push(`[DECISION] C2D Action: ${actionDesc} | Latency: ${actualLatencyMs}ms`);
      
      let physicsOutcome = "";
      if (isCollided) {
        physicsOutcome = `💥 [COLLISION] Impact! Gap was ${distanceRef.current.toFixed(0)}cm, slid ${slidingDist.toFixed(0)}cm. HP reduced to ${newHp}.`;
      } else if (newHp <= 0) {
        physicsOutcome = `💀 [DEADLOCK] Hardware disabled (HP=0).`;
      } else if (newBattery < 5) {
        physicsOutcome = `🪫 [LOW BATTERY] Critically low power (Battery=${newBattery.toFixed(0)}%).`;
      } else if (isBlocked) {
        physicsOutcome = `🛡️ [SAFETY HALT] Strategic Stop triggered. Stopped safely.`;
      } else {
        physicsOutcome = `✅ [NORMAL] Moving forward safely.`;
      }
      
      logsToAppend.push(`[PHYSICS] V: ${velocityRef.current.toFixed(2)}m/s | Sliding: ${slidingDist.toFixed(1)}cm | Gap: ${distanceRef.current.toFixed(0)}cm | Temp: ${newTemp}°C | ${physicsOutcome}`);

      if (newTemp > 60) {
        logsToAppend.push(`[WARNING] Core Temp ${newTemp}°C is high! Thermal throttle active (Extra battery drain).`);
      }

      setCollisionLogs(prev => [...logsToAppend, ...prev]);

      // If deadlocked, low battery, safety block, or collision, stop Autopilot loop
      if (newHp <= 0 || newBattery < 5 || isBlocked || isCollided || !moveAction) {
        setAutopilot(false);
        setVelocity(0);
        return false;
      }

      return true;
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
      if (jitterEnabled) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      const res = await fetch("/api/simulate_agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          obstacle_distance_cm: distance,
          current_x: currentX,
          target_speed: targetSpeed,
          velocity: velocity,
          hp: hp,
          battery: battery,
          temperature: temperature,
          override_config: {
            agent_router_prompt: routerPrompt,
            agent_safety_rules: safetyRules,
            agent_execution_schema: executionSchema
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned error status: ${res.status}`);
      }

      const data: SimulateResponse = await res.json();
      setResponse(data);
      
      const actualLatencyMs = data.latency_ms + (jitterEnabled ? 2500 : 0);
      const isBlocked = data.pipeline_trace.some(step => step.status === "BLOCKED");
      setIsAlert(isBlocked);

      // Perform physics update
      const t = actualLatencyMs / 1000;
      const slidingDist = velocity * t * 100; // in cm
      const moveAction = data.final_action.find(act => act.action === "move");
      
      let newHp = hp;
      let newBattery = battery;
      let newTemp = temperature;
      let newVelocity = velocity;
      let isCollided = false;

      // 1. Check for collision & update position/speed
      if (slidingDist > distance && distance > 0) {
        newHp = Math.max(0, newHp - 50);
        isCollided = true;
        setHp(newHp);
        
        // Physical impact: vehicle travels the remaining distance, hits the wall, and stops
        setCurrentX(prev => Number((prev + distance / 100).toFixed(2)));
        setDistance(0);
        setVelocity(0);
        newVelocity = 0;
      } else {
        // Safe slide during latency period
        setCurrentX(prev => Number((prev + slidingDist / 100).toFixed(2)));
        setDistance(prev => Math.max(0, Number((prev - slidingDist).toFixed(1))));
        
        // Apply new command's velocity for the next leg
        if (moveAction) {
          const speed = moveAction.speed || 50; // cm/s
          newVelocity = speed / 100; // m/s
          setVelocity(newVelocity);
        } else {
          newVelocity = 0;
          setVelocity(0);
        }
      }

      // 2. Battery consumption logic
      let batteryDrain = 0.6;
      if (data.final_action.some(act => act.action === "stop" || act.action === "emergency_halt")) {
        batteryDrain += 2.0;
      }
      if (data.final_action.some(act => act.action === "turn" || act.action === "reverse")) {
        batteryDrain += 1.2;
      }
      
      if (newTemp > 60) {
        const speed = moveAction ? (moveAction.speed || 50) : 0;
        if (velocity > 0.5 || speed > 20) {
          batteryDrain += 3.0;
        } else {
          newTemp = Math.max(40, newTemp - 4);
          setTemperature(newTemp);
        }
      } else {
        if (data.final_action.some(act => act.action === "move" && (act.speed || 50) > 60)) {
          newTemp = Math.min(100, newTemp + 3);
          setTemperature(newTemp);
        } else {
          newTemp = Math.max(40, newTemp - 1);
          setTemperature(newTemp);
        }
      }

      newBattery = Math.max(0, newBattery - batteryDrain);
      setBattery(newBattery);

      // 3. Step Logging (Detailed feedback on every tick)
      const logsToAppend: string[] = [];
      const actionDesc = moveAction ? `MOVE (${moveAction.speed || 50}cm/s)` : data.final_action[0]?.action?.toUpperCase() || "HALT";
      
      logsToAppend.push(`[DECISION] C2D Action: ${actionDesc} | Latency: ${actualLatencyMs}ms`);
      
      let physicsOutcome = "";
      if (isCollided) {
        physicsOutcome = `💥 [COLLISION] Impact! Gap was ${distance.toFixed(0)}cm, slid ${slidingDist.toFixed(0)}cm. HP reduced to ${newHp}.`;
      } else if (newHp <= 0) {
        physicsOutcome = `💀 [DEADLOCK] Hardware disabled (HP=0).`;
      } else if (newBattery < 5) {
        physicsOutcome = `🪫 [LOW BATTERY] Critically low power (Battery=${newBattery.toFixed(0)}%).`;
      } else if (isBlocked) {
        physicsOutcome = `🛡️ [SAFETY HALT] Strategic Stop triggered. Stopped safely.`;
      } else {
        physicsOutcome = `✅ [NORMAL] Moving forward safely.`;
      }
      
      logsToAppend.push(`[PHYSICS] V: ${velocity.toFixed(2)}m/s | Sliding: ${slidingDist.toFixed(1)}cm | Gap: ${distance.toFixed(0)}cm | Temp: ${newTemp}°C | ${physicsOutcome}`);

      if (newTemp > 60) {
        logsToAppend.push(`[WARNING] Core Temp ${newTemp}°C is high! Thermal throttle active (Extra battery drain).`);
      }

      setCollisionLogs(prev => [...logsToAppend, ...prev]);

      if (newHp <= 0 || newBattery < 5 || isBlocked || isCollided || !moveAction) {
        setVelocity(0);
        return;
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

  const renderSandboxTab = () => {
    return (
      <div className="border border-slate-900 bg-slate-950/70 backdrop-blur-sm rounded-xl p-5 space-y-4 shadow-inner shadow-black/80">
        <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-cyan-400 flex items-center space-x-2">
          <span>🛠️ Orchestration Sandbox</span>
          <span className="text-[10px] text-slate-500 normal-case font-normal">(Override Agent Configs on the Fly)</span>
        </h3>
        
        <div className="flex flex-col space-y-1.5">
          <label className="text-[10px] font-mono font-bold uppercase text-slate-500">Agent 1: Router Prompt Override</label>
          <textarea
            value={routerPrompt}
            onChange={(e) => setRouterPrompt(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs font-mono h-24 focus:border-cyan-500 focus:outline-none transition leading-relaxed"
            placeholder="System prompt for classification router..."
          />
        </div>

        <div className="flex flex-col space-y-1.5">
          <label className="text-[10px] font-mono font-bold uppercase text-slate-500">Agent 2: Safety Rules Override</label>
          <textarea
            value={safetyRules}
            onChange={(e) => setSafetyRules(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs font-mono h-24 focus:border-cyan-500 focus:outline-none transition leading-relaxed"
            placeholder="Rules applied by safety firewall..."
          />
        </div>

        <div className="flex flex-col space-y-1.5">
          <label className="text-[10px] font-mono font-bold uppercase text-slate-500">Agent 3: Execution Schema Override</label>
          <textarea
            value={executionSchema}
            onChange={(e) => setExecutionSchema(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs font-mono h-20 focus:border-cyan-500 focus:outline-none transition leading-relaxed"
            placeholder="Expected JSON motor schema output..."
          />
        </div>
        
        <div className="pt-2 text-[10px] text-slate-500 leading-normal border-t border-slate-900">
          💡 Edits made here will override the default tenant configuration database live on subsequent manual or autopilot evaluation steps.
        </div>
      </div>
    );
  };

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
                  const val = Number(e.target.value);
                  setTargetSpeed(val);
                  if (collisionLogs.length === 0 && !response) {
                    setVelocity(val / 100);
                  }
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

        {/* Hazard Event Injection Panel (Blueprint 005 Section 1.1) */}
        <div className="max-w-7xl mx-auto mt-5 p-4 bg-slate-900/10 border border-slate-900 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span>
            <span className="text-xs uppercase tracking-wider font-mono text-slate-400 font-bold">Physical Hazard Event Injector:</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => {
                setDistance(12);
                setVelocity(1.8);
                setCollisionLogs(prev => [`[EVENT] Injected DYNAMIC OBSTACLE (Worker suddenly stepped in front of AGV at 12cm distance, velocity spikes to 1.8m/s).`, ...prev]);
              }}
              className="bg-purple-950/40 border border-purple-500/20 hover:border-purple-500/50 text-purple-300 text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition"
            >
              👷‍♂️ Worker Appears (Type 1)
            </button>
            <button
              onClick={() => {
                setDistance(28);
                setCollisionLogs(prev => [`[EVENT] Injected STATIC CONGESTION (Fallen cargo detected on route at 28cm).`, ...prev]);
              }}
              className="bg-indigo-950/40 border border-indigo-500/20 hover:border-indigo-500/50 text-indigo-300 text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition"
            >
              📦 Fallen Cargo (Type 2)
            </button>
            <button
              onClick={() => {
                setTemperature(85);
                setCollisionLogs(prev => [`[EVENT] Injected MOTOR OVERHEATING (Core temperature spiked to 85°C. Cooling down requires reducing speed < 0.5m/s).`, ...prev]);
              }}
              className="bg-amber-950/40 border border-amber-500/20 hover:border-amber-500/50 text-amber-300 text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition"
            >
              🔥 Overheating (Type 3)
            </button>
            <button
              onClick={() => {
                const nextJitter = !jitterEnabled;
                setJitterEnabled(nextJitter);
                setCollisionLogs(prev => [`[EVENT] Network Jitter Simulation ${nextJitter ? "ENABLED (+2500ms cloud latency spike)" : "DISABLED"}.`, ...prev]);
              }}
              className={`text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition border ${
                jitterEnabled 
                  ? "bg-red-950/50 border-red-500/40 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.2)]" 
                  : "bg-slate-900 border-slate-800 text-slate-455 hover:border-slate-700"
              }`}
            >
              📶 {jitterEnabled ? "Network Jitter: ON" : "Network Jitter: OFF"} (Type 4)
            </button>
            <button
              onClick={() => {
                setHp(100);
                setBattery(100);
                setVelocity(targetSpeed / 100); // Reset to match the current slider speed cap
                setTemperature(40);
                setDistance(80);
                setCurrentX(0);
                setIsAlert(false);
                setResponse(null);
                setError(null);
                setCollisionLogs([]);
              }}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/30 hover:text-cyan-400 text-slate-350 text-xs px-3.5 py-2 rounded-lg font-mono transition"
            >
              🔄 Reset Twins
            </button>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="max-w-7xl mx-auto mt-5 flex justify-end space-x-4">
          <button
            onClick={() => setAutopilot(prev => !prev)}
            className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase transition shadow-lg ${
              autopilot
                ? "bg-red-500 hover:bg-red-600 text-white animate-pulse border border-red-400/50 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
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
                ? "bg-slate-900 border border-slate-800 text-slate-650 cursor-not-allowed"
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
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                hp <= 0
                  ? "bg-slate-950 border-slate-800 text-slate-500 animate-none"
                  : isAlert 
                    ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse font-bold" 
                    : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              }`}>
                {hp <= 0 ? "DEADLOCK" : isAlert ? "Safety Halt" : "Active"}
              </span>
            </div>

            {/* Render Visual twin or Cloud topology flowchart */}
            {viewMode === "physical" ? (
              <PhysicalTwinVisualizer
                distance={distance}
                currentX={currentX}
                robotPosition={robotPosition}
                isAlert={isAlert}
                hp={hp}
                battery={battery}
                velocity={velocity}
                temperature={temperature}
                latencyMs={response ? response.latency_ms + (jitterEnabled ? 2500 : 0) : (jitterEnabled ? 2500 : 800)}
              />
            ) : viewMode === "topology" ? (
              <CloudTopologyFlowchart isAlert={isAlert} />
            ) : (
              renderSandboxTab()
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
            <span className="font-bold text-slate-400 uppercase">Verification Rule:</span> If Agent 2 triggers <span className="text-red-400">BLOCKED</span>, the pipeline immediately short-circuits. Agent 3 shows <span className="text-slate-655 font-bold">SKIPPED</span> to save LLM tokens and guarantee low-latency safety overrides.
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
                      (response.latency_ms + (jitterEnabled ? 2500 : 0)) > 2000 ? "text-red-400" : "text-cyan-400"
                    }`}>
                      {response.latency_ms + (jitterEnabled ? 2500 : 0)} ms
                    </span>
                  </div>
                )}
              </div>

              {/* Infrastructure Telemetry Panel */}
              <InfraTelemetryPanel metrics={response?.cloud_metrics} />

              {/* Black Terminal Code Console */}
              <AuditTerminalConsole response={response} logs={collisionLogs} />
            </div>

            {/* Platform statistics */}
            <div className="border border-slate-900 bg-slate-950 rounded-xl p-3 flex justify-around text-center text-xs font-mono">
              <div>
                <div className="text-slate-500 text-[10px] uppercase">Latency</div>
                <div className="text-cyan-400 font-bold text-sm mt-0.5">
                  {response ? `${response.latency_ms + (jitterEnabled ? 2500 : 0)}ms` : "--"}
                </div>
              </div>
              <div className="border-r border-slate-900"></div>
              <div>
                <div className="text-slate-500 text-[10px] uppercase">Pipeline Status</div>
                <div className={`font-bold text-sm mt-0.5 uppercase ${
                  hp <= 0 
                    ? "text-slate-500" 
                    : isAlert 
                      ? "text-red-400" 
                      : response 
                        ? "text-emerald-400" 
                        : "text-slate-600"
                }`}>
                  {hp <= 0 ? "Deadlock" : isAlert ? "Blocked" : response ? "Passed" : "Idle"}
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
