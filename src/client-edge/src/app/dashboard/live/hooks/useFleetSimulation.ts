"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUTOPILOT_INTERVAL_MS,
  DEFAULT_CONFIGS,
  HP_COLLISION_DAMAGE,
  JITTER_DELAY_MS,
  REQUEST_GAP_MS,
} from "../config/simulation";
import { ExitPath, getScenario, LIVE_SCENARIOS, ScenarioId } from "../config/scenarios";
import { classifyExit, countModelCalls } from "../lib/scenarios";
import { applyDecision, DecisionWait, FleetState, PhysicsStepResult } from "../lib/physics";
import {
  buildSimulationPayload,
  fetchSimulation,
  SimulateResponse,
  SimulationSnapshot,
} from "../lib/simulation";

/** One row of the "run all scenarios" table. */
export interface SuiteRow {
  id: ScenarioId;
  expected: ExitPath;
  observed: ExitPath | null;
  calls: number | null;
  latencyMs: number | null;
  ok: boolean;
  error?: string;
}

export interface SuiteState {
  running: boolean;
  rows: SuiteRow[];
}

/** Result of one cloud round trip. */
interface StepOutcome {
  shouldContinue: boolean;
  response: SimulateResponse | null;
}

export interface FleetSimulation {
  // Core telemetry state
  hp: number;
  battery: number;
  velocity: number;
  temperature: number;
  distance: number; // setting: obstacle distance from the start position; does not change while driving
  gap: number; // live gap to the obstacle = distance - travelled
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
  // True while the motion loop is moving the AGV (the view uses a linear transition then).
  moving: boolean;

  // Scenario presets
  activeScenario: ScenarioId | null;
  observedExit: ExitPath | null; // which pipeline path the last response took
  suite: SuiteState;

  // Actions
  triggerSimulation: () => Promise<void>;
  toggleAutopilot: () => void;
  reset: () => void;
  toggleJitter: () => void;
  applyScenario: (id: ScenarioId) => void;
  runSuite: () => Promise<void>;

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

// Map obstacle distance (cm) to the robot's horizontal position (% of the track).
function positionFromDistance(distanceCm: number): number {
  return Math.max(10, Math.min(80, 80 - distanceCm * 0.7));
}

/**
 * useState whose latest value is also kept in a ref, updated synchronously by the setter.
 * The motion loop and async request handlers read the ref, so they never see a stale render.
 */
function useLiveState<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const ref = useRef<T>(initial);
  const set = useCallback((value: T | ((prev: T) => T)) => {
    const next = typeof value === "function" ? (value as (prev: T) => T)(ref.current) : value;
    ref.current = next;
    setState(next);
  }, []);
  return [state, set, ref] as const;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const MAX_FRAME_DT_S = 0.1; // clamp long frames (tab in background) so the AGV doesn't teleport

export function useFleetSimulation(): FleetSimulation {
  // Autopilot navigation loop state
  const [autopilot, setAutopilot] = useState<boolean>(false);

  // Core state variables (Blueprint 005)
  // Motion state lives in useLiveState: the motion loop and request handlers read the refs.
  const [hp, setHp, hpRef] = useLiveState<number>(100);
  const [battery, setBattery, batteryRef] = useLiveState<number>(100);
  const [velocity, setVelocity, velocityRef] = useLiveState<number>(0.5); // m/s
  const [temperature, setTemperature, temperatureRef] = useLiveState<number>(40); // °C
  const [jitterEnabled, setJitterEnabled] = useState<boolean>(false);
  const [collisionLogs, setCollisionLogs] = useState<string[]>([]);

  // Input states
  const [tenantId, setTenantId] = useState<string>("Tenant-Alpha");
  // `distance` is a SETTING (obstacle distance from the start position). How far the AGV has
  // driven is tracked separately in `travelled`; the live gap is distance - travelled.
  const [distance, setDistance, distanceRef] = useLiveState<number>(80); // cm
  const [travelled, setTravelled, travelledRef] = useLiveState<number>(0); // cm
  const [currentX, setCurrentX, currentXRef] = useLiveState<number>(0);
  const [targetSpeed, setTargetSpeed] = useState<number>(50); // cm/s

  // Prompt configuration overrides (Blueprint 006)
  const [routerPrompt, setRouterPrompt] = useState<string>("");
  const [safetyRules, setSafetyRules] = useState<string>("");
  const [executionSchema, setExecutionSchema] = useState<string>("");

  // API response states
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<SimulateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isAlert, setIsAlert] = useState<boolean>(false);
  // Set by the motion loop when the AGV hits the obstacle while a decision is still pending.
  const collidedRef = useRef(false);
  // The car's starting state: X coordinate, speed, HP, battery, temperature. Defaults are a
  // healthy car; a scenario preset can change them (e.g. battery 3%). Every Start / single step
  // puts the car back to this state.
  const initialSceneRef = useRef({ currentX: 0, velocity: 0.5, hp: 100, battery: 100, temperature: 40 });
  const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(null);
  const [suite, setSuite] = useState<SuiteState>({ running: false, rows: [] });
  const suiteRunningRef = useRef(false);
  const lastRequestAtRef = useRef(0); // when the last cloud request was sent

  // Refs for values the async handlers read (avoids stale closures). Motion values use useLiveState.
  const tenantIdRef = useRef(tenantId);
  const targetSpeedRef = useRef(targetSpeed);
  const autopilotRef = useRef(autopilot);

  const jitterEnabledRef = useRef(jitterEnabled);
  const routerPromptRef = useRef(routerPrompt);
  const safetyRulesRef = useRef(safetyRules);
  const executionSchemaRef = useRef(executionSchema);

  useEffect(() => { tenantIdRef.current = tenantId; }, [tenantId]);
  useEffect(() => { targetSpeedRef.current = targetSpeed; }, [targetSpeed]);
  useEffect(() => { autopilotRef.current = autopilot; }, [autopilot]);

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

  // Apply a decision result to React state in one batch.
  const applyStepResult = useCallback((result: PhysicsStepResult) => {
    setIsAlert(result.isBlocked || result.isCollided);
    setHp(result.state.hp);
    setBattery(result.state.battery);
    setVelocity(result.state.velocity);
    setTemperature(result.state.temperature);
    // Position is owned by the motion loop; a decision only changes speed, temperature, battery.
    setCollisionLogs((prev) => [...result.logs, ...prev]);
  }, [setHp, setBattery, setVelocity, setTemperature]);

  // Put the car back at the start and clear everything that describes the car and its last run.
  // Settings (obstacle distance, speed cap, tenant prompts, jitter toggle) are left untouched.
  const resetCar = useCallback(() => {
    setTravelled(0);
    setCurrentX(initialSceneRef.current.currentX);
    setVelocity(initialSceneRef.current.velocity);
    setHp(initialSceneRef.current.hp);
    setBattery(initialSceneRef.current.battery);
    setTemperature(initialSceneRef.current.temperature);
    setIsAlert(false);
    setResponse(null); // also clears the latency readout
    setError(null);
    setCollisionLogs([]);
    collidedRef.current = false;
  }, [setTravelled, setCurrentX, setVelocity, setHp, setBattery, setTemperature]);

  // One cloud round trip. The AGV is NOT paused or moved here: the motion loop below keeps it
  // moving at its current velocity while this request is in flight, and the decision only
  // takes effect when the response arrives (e.g. a "stop" command), like a real vehicle.
  // The outcome says whether autopilot may continue and carries the response.
  const runStep = useCallback(async (): Promise<StepOutcome> => {
    setLoading(true);
    setError(null);
    collidedRef.current = false;

    try {
      if (jitterEnabledRef.current) {
        await sleep(JITTER_DELAY_MS);
      }

      // The telemetry is a snapshot from the moment of sending; it will be stale on arrival.
      const snapshot: SimulationSnapshot = {
        tenant_id: tenantIdRef.current,
        obstacle_distance_cm: Math.round(Math.max(0, distanceRef.current - travelledRef.current) * 10) / 10,
        current_x: Math.round(currentXRef.current * 100) / 100,
        target_speed: targetSpeedRef.current,
        velocity: velocityRef.current,
        hp: hpRef.current,
        battery: batteryRef.current,
        temperature: temperatureRef.current,
      };
      const sentGapCm = Math.max(0, distanceRef.current - travelledRef.current);
      const sentSpeedMps = velocityRef.current;

      const payload = buildSimulationPayload(snapshot, {
        agent_router_prompt: routerPromptRef.current,
        agent_safety_rules: safetyRulesRef.current,
        agent_execution_schema: executionSchemaRef.current,
      });

      lastRequestAtRef.current = Date.now();
      const data = await fetchSimulation(payload);
      setResponse(data);

      // Response arrived: apply the decision to the fleet as it is now.
      const fleetNow: FleetState = {
        hp: hpRef.current,
        battery: batteryRef.current,
        velocity: velocityRef.current,
        temperature: temperatureRef.current,
        distance: Math.max(0, distanceRef.current - travelledRef.current), // live gap
        currentX: currentXRef.current,
      };
      const wait: DecisionWait = {
        speedMps: sentSpeedMps,
        gapAtSendCm: sentGapCm,
        slidingCm: Math.max(0, sentGapCm - Math.max(0, distanceRef.current - travelledRef.current)),
        collidedWhileWaiting: collidedRef.current,
      };
      const result = applyDecision(fleetNow, data, jitterEnabledRef.current, wait);
      applyStepResult(result);

      if (!result.shouldContinue) {
        setAutopilot(false);
      }
      return { shouldContinue: result.shouldContinue, response: data };
    } catch (err: any) {
      setError(err.message || "Failed to contact backend API");
      setResponse(null);
      setIsAlert(true);
      setAutopilot(false);
      return { shouldContinue: false, response: null };
    } finally {
      setLoading(false);
    }
  }, [applyStepResult, distanceRef, travelledRef, currentXRef, velocityRef, hpRef, batteryRef, temperatureRef]);

  // Single-step manual evaluation trigger
  const triggerSimulation = useCallback(async () => {
    if (autopilotRef.current) {
      setAutopilot(false);
    }
    resetCar();
    await runStep();
  }, [runStep, resetCar]);

  // Load a scenario preset: settings + the car's starting state, then show that state.
  const applyScenario = useCallback((id: ScenarioId) => {
    const sc = getScenario(id);
    setAutopilot(false);
    setActiveScenario(id);
    setDistance(sc.setup.distanceCm);
    setTargetSpeed(Math.min(100, Math.round(sc.setup.speedMps * 100)));
    initialSceneRef.current = {
      ...initialSceneRef.current,
      velocity: sc.setup.speedMps,
      hp: sc.setup.hp,
      battery: sc.setup.battery,
      temperature: sc.setup.temperatureC,
    };
    resetCar();
    setCollisionLogs([`[EVENT] Scenario loaded: ${sc.logName}.`]);
  }, [setDistance, resetCar]);

  // Run every preset once, in order, and record which path each one took.
  const runSuite = useCallback(async () => {
    if (suiteRunningRef.current) return;
    suiteRunningRef.current = true;
    setAutopilot(false);
    const rows: SuiteRow[] = [];
    setSuite({ running: true, rows });
    for (const sc of LIVE_SCENARIOS) {
      // The backend allows one request per ~5s, so wait out the remainder of that window.
      const wait = REQUEST_GAP_MS - (Date.now() - lastRequestAtRef.current);
      if (wait > 0 && lastRequestAtRef.current > 0) await sleep(wait);
      applyScenario(sc.id);
      const outcome = await runStep();
      const observed = classifyExit(outcome.response);
      rows.push({
        id: sc.id,
        expected: sc.expect,
        observed,
        calls: outcome.response ? countModelCalls(outcome.response) : null,
        latencyMs: outcome.response?.latency_ms ?? null,
        ok: observed === sc.expect,
        error: outcome.response ? undefined : "request failed",
      });
      setSuite({ running: true, rows: [...rows] });
    }
    setSuite({ running: false, rows: [...rows] });
    suiteRunningRef.current = false;
  }, [applyScenario, runStep]);

  // Autopilot loop using sequential recursive setTimeout to prevent request pile-up.
  useEffect(() => {
    if (!autopilot) return;

    let active = true;
    let timerId: NodeJS.Timeout | null = null;

    const executeCycle = async () => {
      if (!active) return;
      const outcome = await runStep();
      if (active && outcome.shouldContinue && autopilotRef.current) {
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
  }, [autopilot, runStep]);

  // ---- Motion loop (the "left side") --------------------------------------------------------
  // Independent of the cloud request: while a run is active (autopilot or a request in flight)
  // the AGV moves at its current velocity every frame. It only stops when a decision sets the
  // velocity to 0 (applyDecision) or when it hits the obstacle.
  const stepMotion = useCallback((dtSeconds: number) => {
    const speedMps = velocityRef.current;
    const gapCm = Math.max(0, distanceRef.current - travelledRef.current);
    if (speedMps <= 0 || gapCm <= 0 || hpRef.current <= 0) return;

    const travelCm = speedMps * dtSeconds * 100;
    if (travelCm >= gapCm) {
      // Hit the obstacle before any decision arrived.
      collidedRef.current = true;
      setCurrentX(currentXRef.current + gapCm / 100);
      setTravelled(distanceRef.current);
      setVelocity(0);
      setHp((prev) => Math.max(0, prev - HP_COLLISION_DAMAGE));
      setIsAlert(true);
      setCollisionLogs((prev) => [
        `💥 [COLLISION] Impact at ${(speedMps * 100).toFixed(0)}cm/s before the cloud decision arrived.`,
        ...prev,
      ]);
      return;
    }
    setCurrentX(currentXRef.current + travelCm / 100);
    setTravelled(travelledRef.current + travelCm);
  }, [setCurrentX, setTravelled, setVelocity, setHp, distanceRef, travelledRef, currentXRef, velocityRef, hpRef]);

  const running = autopilot || loading;
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, MAX_FRAME_DT_S);
      last = now;
      stepMotion(dt);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, stepMotion]);

  const gap = Math.max(0, distance - travelled);
  const moving = running && velocity > 0 && gap > 0 && hp > 0;
  const robotPosition = positionFromDistance(gap);

  const updateTenant = useCallback((id: string) => {
    setTenantId(id);
    setDistance(80); // Reset distance on tenant change to allow room to drive
    setTravelled(0);
    setAutopilot(false);
  }, [setDistance, setTravelled]);

  const updateDistance = useCallback((value: number) => {
    setActiveScenario(null); // the preset's expected path no longer applies
    setDistance(value);
    setTravelled(0); // the car sits at the start of the new distance
    setAutopilot((prev) => (prev ? false : prev)); // pause autopilot if manual adjust
  }, [setDistance, setTravelled]);

  const updateCurrentX = useCallback((value: number) => {
    initialSceneRef.current.currentX = value;
    setCurrentX(value);
  }, []);

  const updateTargetSpeed = useCallback((value: number) => {
    setActiveScenario(null);
    initialSceneRef.current.velocity = value / 100;
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

  const reset = useCallback(() => {
    setHp(100);
    setBattery(100);
    setVelocity(targetSpeedRef.current / 100); // Reset to match the current slider speed cap
    setTemperature(40);
    setDistance(80);
    setTravelled(0);
    setCurrentX(0);
    setIsAlert(false);
    collidedRef.current = false;
    setResponse(null);
    setError(null);
    setCollisionLogs([]);
    initialSceneRef.current = { currentX: 0, velocity: targetSpeedRef.current / 100, hp: 100, battery: 100, temperature: 40 };
    setActiveScenario(null);
    setSuite({ running: false, rows: [] });
  }, [setTravelled]);

  // Start always begins a fresh run: the car goes back to the start and all of its state and
  // the logs are cleared. Settings above are kept.
  const toggleAutopilot = useCallback(() => {
    if (autopilotRef.current) {
      setAutopilot(false);
      return;
    }
    resetCar();
    setAutopilot(true);
  }, [resetCar]);

  return {
    hp,
    battery,
    velocity,
    temperature,
    distance,
    gap,
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
    moving,
    activeScenario,
    observedExit: classifyExit(response),
    suite,
    triggerSimulation,
    toggleAutopilot,
    reset,
    toggleJitter,
    applyScenario,
    runSuite,
    updateTenant,
    updateDistance,
    updateCurrentX,
    updateTargetSpeed,
    setRouterPrompt,
    setSafetyRules,
    setExecutionSchema,
  };
}
