"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TrackId, TrackConfig, Scenario, SCENARIOS, getScenario, ScenarioId } from "../config/scenarios";
import { computeCloudLatencyMs, brakingDistanceM, slideDistanceM } from "../../shared/physics";
import { LLMBreakdownParams } from "../../shared/physics";

const JITTER_RANGE = 0.0;
function jittered(base: number): number {
  return base * (1 + (Math.random() * 2 - 1) * JITTER_RANGE);
}

type TrackStatus = "idle" | "running" | "crashed" | "safe_stop";
type SimPhase = "idle" | "running" | "paused";

interface TrackState {
  status: TrackStatus;
  positionM: number;
}

type TrackSim = {
  trackConfig: TrackConfig;
  accumS: number;
  nextS: number;
  stepNum: number;
};

export interface FleetSimulationState {
  tracks: Record<TrackId, TrackState>;
  activeScenario: Scenario;
  simPhase: SimPhase;
  fleetStatus: "idle" | "running" | "all_safe" | "any_crashed" | "mixed" | "paused";
  elapsedS: number;
  tokenLLM: LLMBreakdownParams;
  globalSpeedMps: number;
  globalClearanceM: number;
}

export interface FleetSimulationActions {
  selectScenario: (id: string) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  updateGlobalSpeed: (v: number) => void;
  updateGlobalClearance: (c: number) => void;
  updateTokenParam: (key: keyof LLMBreakdownParams, value: number) => void;
}

export function useFleetSimulation2(): FleetSimulationState & FleetSimulationActions {
  const [activeScenario, setActiveScenario] = useState<Scenario>(SCENARIOS[0]);
  const [tracks, setTracks] = useState<Record<TrackId, TrackState>>({
    agv01: { status: "idle", positionM: 0 },
    agv02: { status: "idle", positionM: 0 },
    agv03: { status: "idle", positionM: 0 },
  });
  const [simPhase, setSimPhase] = useState<SimPhase>("idle");
  const [elapsedS, setElapsedS] = useState(0);
  const [tokenLLM, setTokenLLM] = useState<LLMBreakdownParams>({ networkRttMs: 80, promptTokens: 250, completionTokens: 300, tokenRateTokS: 200 });
  const [globalSpeedMps, setGlobalSpeedMps] = useState(1.0);
  const [globalClearanceM, setGlobalClearanceM] = useState(2.0);

  // Refs for the animation loop (avoid stale closures)
  const animRef = useRef<number | null>(null);
  const genRef = useRef(0);
  const posRef = useRef<Record<TrackId, number>>({ agv01: 0, agv02: 0, agv03: 0 });
  const statusRef = useRef<Record<TrackId, TrackStatus>>({ agv01: "idle", agv02: "idle", agv03: "idle" });
  const elapsedRef = useRef(0);
  const scenarioRef = useRef(activeScenario);
  const tokenLLMRef = useRef(tokenLLM);
  const speedRef = useRef(globalSpeedMps);
  const clearanceRef = useRef(globalClearanceM);
  const trackSimsRef = useRef<Record<TrackId, TrackSim> | null>(null);

  scenarioRef.current = activeScenario;
  tokenLLMRef.current = tokenLLM;
  speedRef.current = globalSpeedMps;
  clearanceRef.current = globalClearanceM;

  const resolveCloudLatencyMs = useCallback((tc: TrackConfig): number => {
    if (tc.cloudLatencyMs !== "computed") return tc.cloudLatencyMs;
    return computeCloudLatencyMs(tokenLLMRef.current);
  }, []);

  const startTimeRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const syncState = useCallback(() => {
    const st = statusRef.current;
    const pos = posRef.current;
    setTracks({
      agv01: { status: st.agv01, positionM: pos.agv01 },
      agv02: { status: st.agv02, positionM: pos.agv02 },
      agv03: { status: st.agv03, positionM: pos.agv03 },
    });
    setElapsedS(elapsedRef.current);
  }, []);

  const launchAnimation = useCallback((resetPositions: boolean) => {
    cleanup();
    const myGen = ++genRef.current;

    if (resetPositions) {
      statusRef.current = { agv01: "running", agv02: "running", agv03: "running" };
      posRef.current = { agv01: 0, agv02: 0, agv03: 0 };
      elapsedRef.current = 0;
      startTimeRef.current = null;
    }

    syncState();
    setSimPhase("running");

    const scenario = scenarioRef.current;

    const trackSims: Record<TrackId, TrackSim> = {
      agv01: { trackConfig: scenario.tracks.agv01, accumS: 0, nextS: 0, stepNum: 0 },
      agv02: { trackConfig: scenario.tracks.agv02, accumS: 0, nextS: 0, stepNum: 0 },
      agv03: { trackConfig: scenario.tracks.agv03, accumS: 0, nextS: 0, stepNum: 0 },
    };

    for (const id of ["agv01", "agv02", "agv03"] as TrackId[]) {
      const ts = trackSims[id];
      const latencyMs = ts.trackConfig.edgeLatencyMs !== null
        ? ts.trackConfig.edgeLatencyMs
        : resolveCloudLatencyMs(ts.trackConfig);
      ts.nextS = jittered(latencyMs) / 1000;
    }

    trackSimsRef.current = trackSims;

    let lastTimestamp: number | null = null;
    let frameCount = 0;

    const animate = (timestamp: number) => {
      if (myGen !== genRef.current) return;
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const deltaS = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const speed = speedRef.current;
      const clearance = clearanceRef.current;
      const totalDistance = scenario.shared.totalDistanceM;
      const brakeReactionS = 15 / 1000;
      const clearanceBoundaryM = Math.max(0, totalDistance - clearance);

      let anyRunning = false;

      for (const id of ["agv01", "agv02", "agv03"] as TrackId[]) {
        const st = statusRef.current[id];
        if (st !== "running") continue;
        anyRunning = true;

        const pos = posRef.current[id];
        const newPos = Math.min(pos + speed * deltaS, totalDistance);
        posRef.current[id] = newPos;

        const ts = trackSims[id];
        const cfg = ts.trackConfig;

        const effectiveLatencyMs = cfg.edgeLatencyMs !== null ? cfg.edgeLatencyMs : resolveCloudLatencyMs(cfg);
        const effectiveEdgeMode = cfg.edgeLatencyMs !== null;
        const detectionBoundaryM = effectiveEdgeMode
          ? clearanceBoundaryM + speed * effectiveLatencyMs / 1000
          : clearanceBoundaryM;

        ts.accumS += deltaS;
        ts.nextS = jittered(effectiveLatencyMs) / 1000;

        if (ts.accumS >= ts.nextS) {
          ts.stepNum += 1;

          if (newPos >= totalDistance) {
            statusRef.current[id] = "crashed";
          } else if (newPos >= detectionBoundaryM) {
            const brakingM = brakingDistanceM(speed, brakeReactionS);
            const finalPos = Math.min(newPos + brakingM, totalDistance);
            posRef.current[id] = finalPos;
            statusRef.current[id] = finalPos >= totalDistance ? "crashed" : "safe_stop";
          }

          ts.accumS = 0;
        }
      }

      elapsedRef.current += deltaS;

      frameCount += 1;
      if (frameCount % 3 === 0) {
        syncState();
      }

      if (!anyRunning) {
        syncState();
        setSimPhase("paused");
        return;
      }

      if (myGen === genRef.current) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
  }, [cleanup, resolveCloudLatencyMs, syncState]);

  const reset = useCallback(() => {
    cleanup();
    genRef.current += 1;
    statusRef.current = { agv01: "idle", agv02: "idle", agv03: "idle" };
    posRef.current = { agv01: 0, agv02: 0, agv03: 0 };
    elapsedRef.current = 0;
    startTimeRef.current = null;
    setSimPhase("idle");
    syncState();
  }, [cleanup, syncState]);

  const start = useCallback(() => {
    launchAnimation(true);
  }, [launchAnimation]);

  const pause = useCallback(() => {
    cleanup();
    genRef.current += 1;
    setSimPhase("paused");
    syncState();
  }, [cleanup, syncState]);

  const resume = useCallback(() => {
    // Restart animation from current positions; don't reset anything
    cleanup();
    const myGen = ++genRef.current;
    syncState();
    setSimPhase("running");

    const scenario = scenarioRef.current;

    // Preserve trackSims from pause state so accumS is not lost
    const trackSims = trackSimsRef.current ?? (() => {
      const fresh: Record<TrackId, TrackSim> = {
        agv01: { trackConfig: scenario.tracks.agv01, accumS: 0, nextS: 0, stepNum: 0 },
        agv02: { trackConfig: scenario.tracks.agv02, accumS: 0, nextS: 0, stepNum: 0 },
        agv03: { trackConfig: scenario.tracks.agv03, accumS: 0, nextS: 0, stepNum: 0 },
      };
      for (const id of ["agv01", "agv02", "agv03"] as TrackId[]) {
        const ts = fresh[id];
        const latencyMs = ts.trackConfig.edgeLatencyMs !== null
          ? ts.trackConfig.edgeLatencyMs
          : resolveCloudLatencyMs(ts.trackConfig);
        ts.nextS = jittered(latencyMs) / 1000;
      }
      return fresh;
    })();

    // Refresh nextS for all tracks (latency may have changed via token drawer)
    for (const id of ["agv01", "agv02", "agv03"] as TrackId[]) {
      const ts = trackSims[id];
      const latencyMs = ts.trackConfig.edgeLatencyMs !== null
        ? ts.trackConfig.edgeLatencyMs
        : resolveCloudLatencyMs(ts.trackConfig);
      ts.nextS = jittered(latencyMs) / 1000;
    }

    trackSimsRef.current = trackSims;

    let lastTimestamp: number | null = null;
    let frameCount = 0;

    const animate = (timestamp: number) => {
      if (myGen !== genRef.current) return;
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const deltaS = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const speed = speedRef.current;
      const clearance = clearanceRef.current;
      const totalDistance = scenario.shared.totalDistanceM;
      const brakeReactionS = 15 / 1000;
      const clearanceBoundaryM = Math.max(0, totalDistance - clearance);

      let anyRunning = false;

      for (const id of ["agv01", "agv02", "agv03"] as TrackId[]) {
        const st = statusRef.current[id];
        if (st !== "running") continue;
        anyRunning = true;

        const pos = posRef.current[id];
        const newPos = Math.min(pos + speed * deltaS, totalDistance);
        posRef.current[id] = newPos;

        const ts = trackSims[id];
        const cfg = ts.trackConfig;

        const effectiveLatencyMs = cfg.edgeLatencyMs !== null ? cfg.edgeLatencyMs : resolveCloudLatencyMs(cfg);
        const effectiveEdgeMode = cfg.edgeLatencyMs !== null;
        const detectionBoundaryM = effectiveEdgeMode
          ? clearanceBoundaryM + speed * effectiveLatencyMs / 1000
          : clearanceBoundaryM;

        ts.accumS += deltaS;
        ts.nextS = jittered(effectiveLatencyMs) / 1000;

        if (ts.accumS >= ts.nextS) {
          ts.stepNum += 1;

          if (newPos >= totalDistance) {
            statusRef.current[id] = "crashed";
          } else if (newPos >= detectionBoundaryM) {
            const brakingM = brakingDistanceM(speed, brakeReactionS);
            const finalPos = Math.min(newPos + brakingM, totalDistance);
            posRef.current[id] = finalPos;
            statusRef.current[id] = finalPos >= totalDistance ? "crashed" : "safe_stop";
          }

          ts.accumS = 0;
        }
      }

      elapsedRef.current += deltaS;
      frameCount += 1;
      if (frameCount % 3 === 0) syncState();

      if (!anyRunning) {
        syncState();
        setSimPhase("paused");
        return;
      }

      if (myGen === genRef.current) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
  }, [cleanup, resolveCloudLatencyMs, syncState]);

  const selectScenario = useCallback((id: string) => {
    cleanup();
    const scenario = getScenario(id);
    setActiveScenario(scenario);
    if (scenario.tracks.agv03.llm) {
      setTokenLLM({ ...scenario.tracks.agv03.llm });
    }
    genRef.current += 1;
    statusRef.current = { agv01: "idle", agv02: "idle", agv03: "idle" };
    posRef.current = { agv01: 0, agv02: 0, agv03: 0 };
    elapsedRef.current = 0;
    setSimPhase("idle");
    syncState();
  }, [cleanup, syncState]);

  const updateGlobalSpeed = useCallback((v: number) => {
    setGlobalSpeedMps(v);
  }, []);

  const updateGlobalClearance = useCallback((c: number) => {
    setGlobalClearanceM(c);
  }, []);

  const updateTokenParam = useCallback((key: keyof LLMBreakdownParams, value: number) => {
    setTokenLLM((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const stValues = Object.values(statusRef.current) as TrackStatus[];
  const hasRunning = stValues.some((v) => v === "running");
  const fleetStatus: FleetSimulationState["fleetStatus"] = simPhase === "paused" && hasRunning ? "paused"
    : stValues.every((v) => v === "idle") ? "idle"
    : hasRunning ? "running"
    : stValues.every((v) => v === "crashed") ? "any_crashed"
    : stValues.every((v) => v === "safe_stop") ? "all_safe"
    : "mixed";

  return {
    tracks,
    activeScenario,
    simPhase,
    fleetStatus,
    elapsedS,
    tokenLLM,
    globalSpeedMps,
    globalClearanceM,
    selectScenario,
    start,
    pause,
    resume,
    reset,
    updateGlobalSpeed,
    updateGlobalClearance,
    updateTokenParam,
  };
}
