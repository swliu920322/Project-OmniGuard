"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KinematicParams, LogEntry, Mode, computeBrakingDistanceM } from "../lib/kinematic";

const JITTER_RANGE = 0.2;

function jittered(base: number): number {
  return base * (1 + (Math.random() * 2 - 1) * JITTER_RANGE);
}

type SimStatus = "idle" | "running" | "crashed" | "safe_stop";

interface UseKinematicSimulationOptions {
  params: KinematicParams;
  mode: Mode;
  onLog: (entry: LogEntry) => void;
}

interface UseKinematicSimulationReturn {
  status: SimStatus;
  positionM: number;
  stepCount: number;
  start: () => void;
  reset: () => void;
}

export function useKinematicSimulation({
  params,
  mode,
  onLog,
}: UseKinematicSimulationOptions): UseKinematicSimulationReturn {
  const [status, setStatus] = useState<SimStatus>("idle");
  const [positionM, setPositionM] = useState(0);
  const [stepCount, setStepCount] = useState(0);

  const paramsRef = useRef(params);
  const modeRef = useRef(mode);
  const onLogRef = useRef(onLog);
  const statusRef = useRef(status);

  paramsRef.current = params;
  modeRef.current = mode;
  onLogRef.current = onLog;
  statusRef.current = status;

  const animRef = useRef<number | null>(null);
  const genRef = useRef(0);
  const posRef = useRef(0);
  const stepRef = useRef(0);

  const cleanup = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const setFinal = useCallback((newStatus: "crashed" | "safe_stop", finalPos: number) => {
    cleanup();
    posRef.current = finalPos;
    setPositionM(finalPos);
    setStatus(newStatus);
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    genRef.current += 1;
    setStatus("idle");
    setPositionM(0);
    setStepCount(0);
    posRef.current = 0;
    stepRef.current = 0;
  }, [cleanup]);

  const start = useCallback(() => {
    cleanup();
    genRef.current += 1;
    posRef.current = 0;
    stepRef.current = 0;
    setPositionM(0);
    setStepCount(0);
    setStatus("running");
  }, [cleanup]);

  // ---- Single animation loop for both modes ----
  useEffect(() => {
    if (status !== "running") return;

    const { agvSpeedMps, totalDistanceM, clearanceM, cloudLatencyMs, edgeLatencyMs, brakeLatencyMs } = paramsRef.current;
    const currentMode = modeRef.current;
    const clearanceBoundaryM = Math.max(0, totalDistanceM - clearanceM);
    const effectiveEdgeBoundaryM = clearanceBoundaryM + agvSpeedMps * edgeLatencyMs / 1000;
    const reactionS = brakeLatencyMs / 1000;
    const myGen = genRef.current;

    const latencyMs = currentMode === "cloud" ? cloudLatencyMs : edgeLatencyMs;
    const detectionBoundaryM = currentMode === "cloud" ? clearanceBoundaryM : effectiveEdgeBoundaryM;
    const logProgress = true;
    const tag = currentMode === "cloud" ? "" : "Edge ";
    const clearZoneLabel = `${clearanceM.toFixed(1)}m`;

    let lastTimestamp: number | null = null;
    let frameCount = 0;

    let accumS = 0;
    let nextS = jittered(latencyMs) / 1000;
    let internalStep = 0;

    onLogRef.current({
      timestamp: new Date().toLocaleTimeString(),
      message: `[START] AGV at 0m heading toward wall. ${currentMode === "cloud" ? `Cloud RTT ${cloudLatencyMs}ms (±20% jitter)` : `Edge latency ${edgeLatencyMs}ms`}, brake ${brakeLatencyMs}ms, clearance zone: last ${clearZoneLabel}.`,
    });

    const animate = (timestamp: number) => {
      if (myGen !== genRef.current) return;
      if (lastTimestamp === null) lastTimestamp = timestamp;

      const deltaS = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const newPos = Math.min(posRef.current + agvSpeedMps * deltaS, totalDistanceM);
      posRef.current = newPos;

      accumS += deltaS;

      if (accumS >= nextS) {
        internalStep += 1;
        const stepNum = internalStep;
        const actualLatencyMs = nextS * 1000;

        if (newPos >= totalDistanceM) {
          onLogRef.current({
            timestamp: new Date().toLocaleTimeString(),
            message: `💥 [CRASH] ${tag}Step ${stepNum}: response at ${newPos.toFixed(2)}m, already hit wall. (latency ${actualLatencyMs.toFixed(0)}ms)`,
          });
          setFinal("crashed", totalDistanceM);
          return;
        }

        if (newPos >= detectionBoundaryM) {
          const brakingM = computeBrakingDistanceM(agvSpeedMps, reactionS);
          const finalPos = Math.min(newPos + brakingM, totalDistanceM);
          setPositionM(finalPos);
          if (currentMode === "cloud") setStepCount(stepNum);
          onLogRef.current({
            timestamp: new Date().toLocaleTimeString(),
            message: `🛡️ [SAFE STOP] ${tag}Step ${stepNum}: response at ${newPos.toFixed(2)}m. Braking ${brakingM.toFixed(3)}m → stop at ${finalPos.toFixed(3)}m. (latency ${actualLatencyMs.toFixed(0)}ms)`,
          });
          setFinal("safe_stop", finalPos);
          return;
        }

        if (logProgress) {
          setStepCount(stepNum);
          onLogRef.current({
            timestamp: new Date().toLocaleTimeString(),
            message: `✅ Step ${stepNum}: ${newPos.toFixed(2)}m, ${(totalDistanceM - newPos).toFixed(2)}m to wall. (latency ${actualLatencyMs.toFixed(0)}ms)`,
          });
        }

        accumS = 0;
        nextS = jittered(latencyMs) / 1000;
      }

      if (frameCount % 3 === 0) setPositionM(newPos);
      frameCount += 1;

      if (myGen === genRef.current) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [status, setFinal]);

  return { status, positionM, stepCount, start, reset };
}
