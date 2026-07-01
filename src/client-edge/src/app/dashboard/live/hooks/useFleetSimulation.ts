"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUTOPILOT_INTERVAL_MS,
  DEFAULT_CONFIGS,
  JITTER_DELAY_MS,
  TENANT_SCENARIOS,
} from "../config/simulation";
import { applyPhysicsStep, FleetState, PhysicsStepResult } from "../lib/physics";
import {
  buildSimulationPayload,
  fetchSimulation,
  SimulateResponse,
  SimulationSnapshot,
} from "../lib/simulation";

export interface FleetSimulation {
  // Core telemetry state
  hp: number;
  battery: number;
  velocity: number;
  temperature: number;
  distance: number;
  currentX: number;
  targetSpeed: number;
  jitterEnabled: boolean;
  collisionLogs: string[];

  // Input / config
  tenantId: string;
  routerPrompt: string;
  safetyRules: string;
  executionSchema: string;

  // API state
  loading: boolean;
  response: SimulateResponse | null;
  error: string | null;
  isAlert: boolean;

  // Autopilot + derived UI state
  autopilot: boolean;
  robotPosition: number;

  // Tenant metadata (read-through for convenience)
  tenantScenarioDesc: string;
  tenantTriggerDist: string;

  // Actions
  triggerSimulation: () => Promise<void>;
  toggleAutopilot: () => void;
  reset: () => void;
  toggleJitter: () => void;
  injectWorkerHazard: () => void;
  injectCargoHazard: () => void;
  injectOverheatingHazard: () => void;

  // Config setters (with their original side effects preserved)
  updateTenant: (id: string) => void;
  updateDistance: (value: number) => void;
  updateCurrentX: (value: number) => void;
  updateTargetSpeed: (value: number) => void;

  // Prompt override setters
  setRouterPrompt: (value: string) => void;
  setSafetyRules: (value: string) => void;
  setExecutionSchema: (value: string) => void;
}

export function useFleetSimulation(): FleetSimulation {
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

  // API response states
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<SimulateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local telemetry representation for animation
  const [robotPosition, setRobotPosition] = useState<number>(50); // visual X offset percentage
  const [isAlert, setIsAlert] = useState<boolean>(false);

  // Refs to store state values for the autopilot loop to avoid stale closures.
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

  // Rehydrate prompt overrides when the active tenant changes.
  useEffect(() => {
    const defaults = DEFAULT_CONFIGS[tenantId];
    if (defaults) {
      setRouterPrompt(defaults.router);
      setSafetyRules(defaults.safety);
      setExecutionSchema(defaults.schema);
    }
  }, [tenantId]);

  // Apply a physics step result to React state in one batch.
  const applyStepResult = useCallback((result: PhysicsStepResult) => {
    setIsAlert(result.isBlocked);
    setHp(result.state.hp);
    setBattery(result.state.battery);
    setVelocity(result.state.velocity);
    setTemperature(result.state.temperature);
    setDistance(result.state.distance);
    setCurrentX(result.state.currentX);
    setCollisionLogs((prev) => [...result.logs, ...prev]);
  }, []);

  // Run a single simulation step (used by autopilot and manual trigger).
  // Returns true if autopilot should continue, false if it should stop.
  const runAutopilotStep = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      if (jitterEnabledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, JITTER_DELAY_MS));
      }

      const snapshot: SimulationSnapshot = {
        tenant_id: tenantIdRef.current,
        obstacle_distance_cm: distanceRef.current,
        current_x: currentXRef.current,
        target_speed: targetSpeedRef.current,
        velocity: velocityRef.current,
        hp: hpRef.current,
        battery: batteryRef.current,
        temperature: temperatureRef.current,
      };
      const payload = buildSimulationPayload(snapshot, {
        agent_router_prompt: routerPromptRef.current,
        agent_safety_rules: safetyRulesRef.current,
        agent_execution_schema: executionSchemaRef.current,
      });

      const data = await fetchSimulation(payload);
      setResponse(data);

      const fleetState: FleetState = {
        hp: hpRef.current,
        battery: batteryRef.current,
        velocity: velocityRef.current,
        temperature: temperatureRef.current,
        distance: distanceRef.current,
        currentX: currentXRef.current,
      };
      const result = applyPhysicsStep(fleetState, data, jitterEnabledRef.current);
      applyStepResult(result);

      if (!result.shouldContinue) {
        setAutopilot(false);
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
  }, [applyStepResult]);

  // Single-Step Manual evaluation trigger
  const triggerSimulation = useCallback(async () => {
    if (autopilotRef.current) {
      setAutopilot(false);
    }

    setLoading(true);
    setError(null);
    try {
      if (jitterEnabledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, JITTER_DELAY_MS));
      }

      const snapshot: SimulationSnapshot = {
        tenant_id: tenantIdRef.current,
        obstacle_distance_cm: distanceRef.current,
        current_x: currentXRef.current,
        target_speed: targetSpeedRef.current,
        velocity: velocityRef.current,
        hp: hpRef.current,
        battery: batteryRef.current,
        temperature: temperatureRef.current,
      };
      const payload = buildSimulationPayload(snapshot, {
        agent_router_prompt: routerPromptRef.current,
        agent_safety_rules: safetyRulesRef.current,
        agent_execution_schema: executionSchemaRef.current,
      });

      const data = await fetchSimulation(payload);
      setResponse(data);

      const fleetState: FleetState = {
        hp: hpRef.current,
        battery: batteryRef.current,
        velocity: velocityRef.current,
        temperature: temperatureRef.current,
        distance: distanceRef.current,
        currentX: currentXRef.current,
      };
      const result = applyPhysicsStep(fleetState, data, jitterEnabledRef.current);
      applyStepResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to contact backend API");
      setResponse(null);
      setIsAlert(true);
    } finally {
      setLoading(false);
    }
  }, [applyStepResult]);

  // Autopilot loop using sequential recursive setTimeout to prevent request pile-up.
  useEffect(() => {
    if (!autopilot) return;

    let active = true;
    let timerId: NodeJS.Timeout | null = null;

    const executeCycle = async () => {
      if (!active) return;
      const shouldContinue = await runAutopilotStep();
      if (active && shouldContinue && autopilotRef.current) {
        timerId = setTimeout(executeCycle, AUTOPILOT_INTERVAL_MS); // Schedule next request AFTER current one fully completes
      }
    };

    executeCycle();

    return () => {
      active = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [autopilot, runAutopilotStep]);

  // Adjust visual position of robot based on distance
  useEffect(() => {
    const newPos = Math.max(10, Math.min(80, 80 - (distance * 0.7)));
    setRobotPosition(newPos);
  }, [distance]);

  const toggleAutopilot = useCallback(() => {
    setAutopilot((prev) => !prev);
  }, []);

  const updateTenant = useCallback((id: string) => {
    setTenantId(id);
    setDistance(80); // Reset distance on tenant change to allow room to drive
    setAutopilot(false);
  }, []);

  const updateDistance = useCallback((value: number) => {
    setDistance(value);
    setAutopilot((prev) => (prev ? false : prev)); // pause autopilot if manual adjust
  }, []);

  const updateCurrentX = useCallback((value: number) => {
    setCurrentX(value);
  }, []);

  const updateTargetSpeed = useCallback((value: number) => {
    setTargetSpeed(value);
    setCollisionLogs((prevLogs) => {
      // Only seed velocity from the cap when no run has happened yet.
      if (prevLogs.length === 0 && !response) {
        setVelocity(value / 100);
      }
      return prevLogs;
    });
  }, [response]);

  const toggleJitter = useCallback(() => {
    setJitterEnabled((prev) => {
      const next = !prev;
      setCollisionLogs((p) => [`[EVENT] Network Jitter Simulation ${next ? "ENABLED (+2500ms cloud latency spike)" : "DISABLED"}.`, ...p]);
      return next;
    });
  }, []);

  const injectWorkerHazard = useCallback(() => {
    setDistance(12);
    setVelocity(1.8);
    setCollisionLogs((prev) => [`[EVENT] Injected DYNAMIC OBSTACLE (Worker suddenly stepped in front of AGV at 12cm distance, velocity spikes to 1.8m/s).`, ...prev]);
  }, []);

  const injectCargoHazard = useCallback(() => {
    setDistance(28);
    setCollisionLogs((prev) => [`[EVENT] Injected STATIC CONGESTION (Fallen cargo detected on route at 28cm).`, ...prev]);
  }, []);

  const injectOverheatingHazard = useCallback(() => {
    setTemperature(85);
    setCollisionLogs((prev) => [`[EVENT] Injected MOTOR OVERHEATING (Core temperature spiked to 85°C. Cooling down requires reducing speed < 0.5m/s).`, ...prev]);
  }, []);

  const reset = useCallback(() => {
    setHp(100);
    setBattery(100);
    setVelocity(targetSpeedRef.current / 100); // Reset to match the current slider speed cap
    setTemperature(40);
    setDistance(80);
    setCurrentX(0);
    setIsAlert(false);
    setResponse(null);
    setError(null);
    setCollisionLogs([]);
  }, []);

  return {
    hp,
    battery,
    velocity,
    temperature,
    distance,
    currentX,
    targetSpeed,
    jitterEnabled,
    collisionLogs,
    tenantId,
    routerPrompt,
    safetyRules,
    executionSchema,
    loading,
    response,
    error,
    isAlert,
    autopilot,
    robotPosition,
    tenantScenarioDesc: TENANT_SCENARIOS[tenantId]?.desc ?? "",
    tenantTriggerDist: TENANT_SCENARIOS[tenantId]?.triggerDist ?? "",
    triggerSimulation,
    toggleAutopilot,
    reset,
    toggleJitter,
    injectWorkerHazard,
    injectCargoHazard,
    injectOverheatingHazard,
    updateTenant,
    updateDistance,
    updateCurrentX,
    updateTargetSpeed,
    setRouterPrompt,
    setSafetyRules,
    setExecutionSchema,
  };
}
