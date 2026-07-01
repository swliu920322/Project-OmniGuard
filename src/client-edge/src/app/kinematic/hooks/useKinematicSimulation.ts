"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KinematicParams, LogEntry, Mode, computeBrakingDistanceM, formatLatency } from "../lib/kinematic";

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
    setStatus("idle");
    setPositionM(0);
    setStepCount(0);
    posRef.current = 0;
    stepRef.current = 0;
  }, [cleanup]);

  const start = useCallback(() => {
    cleanup();
    posRef.current = 0;
    stepRef.current = 0;
    setPositionM(0);
    setStepCount(0);
    setStatus("running");
  }, [cleanup]);

  // ---- Single animation loop for both modes ----
  useEffect(() => {
    if (status !== "running") return;

    const { agvSpeedMps, totalDistanceM, clearanceM, cloudLatencyMs, edgeReactionMs } = paramsRef.current;
    const currentMode = modeRef.current;
    const clearanceBoundaryM = Math.max(0, totalDistanceM - clearanceM);
    const latencyS = currentMode === "cloud" ? cloudLatencyMs / 1000 : edgeReactionMs / 1000;

    let lastTimestamp: number | null = null;
    let running = true;
    let frameCount = 0;
    let stepLogged = false;

    // Cloud-specific state: step tracking
    let cloudStepAccumS = 0;
    let cloudNextLatencyS = currentMode === "cloud" ? jittered(cloudLatencyMs) / 1000 : 0;
    let cloudStartPos = currentMode === "cloud" ? 0 : 0;

    const animate = (timestamp: number) => {
      if (!running) return;
      if (lastTimestamp === null) lastTimestamp = timestamp;

      const deltaS = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const newPos = Math.min(posRef.current + agvSpeedMps * deltaS, totalDistanceM);
      posRef.current = newPos;

      if (currentMode === "edge") {
        // Edge: continuous obstacle detection
        if (newPos >= clearanceBoundaryM) {
          setPositionM(newPos);
          const brakingM = computeBrakingDistanceM(agvSpeedMps, edgeReactionMs / 1000);
          const finalPos = Math.min(newPos + brakingM, totalDistanceM);

          if (finalPos >= totalDistanceM) {
            onLogRef.current({
              timestamp: new Date().toLocaleTimeString(),
              message: `💥 [CRASH] Obstacle detected at ${newPos.toFixed(1)}m but braking distance ${brakingM.toFixed(2)}m exceeds remaining space.`,
            });
            setFinal("crashed", totalDistanceM);
          } else {
            setPositionM(finalPos);
            onLogRef.current({
              timestamp: new Date().toLocaleTimeString(),
              message: `🛡️ [EDGE SAFE STOP] Obstacle at ${newPos.toFixed(1)}m. Edge reaction ${edgeReactionMs}ms → braking ${brakingM.toFixed(2)}m. Stopped at ${finalPos.toFixed(2)}m.`,
            });
            setFinal("safe_stop", finalPos);
          }
          return;
        }

        if (newPos >= totalDistanceM) {
          setPositionM(newPos);
          onLogRef.current({
            timestamp: new Date().toLocaleTimeString(),
            message: `💥 [CRASH] AGV reached wall at ${totalDistanceM.toFixed(1)}m!`,
          });
          setFinal("crashed", totalDistanceM);
          return;
        }

        // Throttle React state sync to ~20fps
        frameCount += 1;
        if (frameCount % 3 === 0) setPositionM(newPos);

        // Periodic progress log (every ~2s)
        if (frameCount % 180 === 0) {
          onLogRef.current({
            timestamp: new Date().toLocaleTimeString(),
            message: `[PROGRESS] Position ${newPos.toFixed(1)}m / ${totalDistanceM.toFixed(0)}m | Remaining ${(totalDistanceM - newPos).toFixed(1)}m.`,
          });
        }
      } else {
        // Cloud: step-based checkpoints
        cloudStepAccumS += deltaS;

        if (cloudStepAccumS >= cloudNextLatencyS) {
          stepRef.current += 1;
          const stepNum = stepRef.current;
          const actualLatencyMs = cloudNextLatencyS * 1000;
          const travelM = agvSpeedMps * cloudNextLatencyS;
          const afterPos = cloudStartPos + travelM;
          const remainingM = totalDistanceM - afterPos;
          const brakingM = computeBrakingDistanceM(agvSpeedMps, cloudNextLatencyS);
          const inClearance = afterPos >= clearanceBoundaryM;

          if (afterPos >= totalDistanceM || (inClearance && brakingM > remainingM)) {
            const crashPos = Math.min(afterPos, totalDistanceM);
            posRef.current = crashPos;
            setPositionM(crashPos);
            setStepCount(stepNum);
            onLogRef.current({
              timestamp: new Date().toLocaleTimeString(),
              message: `💥 [CRASH] Step ${stepNum}: Entered clearance at ${crashPos.toFixed(1)}m. Braking ${brakingM.toFixed(1)}m > remaining ${Math.max(0, remainingM).toFixed(1)}m. (latency ${actualLatencyMs.toFixed(0)}ms)`,
            });
            setFinal("crashed", crashPos);
            return;
          }

          if (inClearance) {
            posRef.current = afterPos;
            setPositionM(afterPos);
            setStepCount(stepNum);
            onLogRef.current({
              timestamp: new Date().toLocaleTimeString(),
              message: `🛡️ [SAFE STOP] Step ${stepNum}: Position ${afterPos.toFixed(1)}m. Braking ${brakingM.toFixed(1)}m ≤ remaining ${remainingM.toFixed(1)}m. (latency ${actualLatencyMs.toFixed(0)}ms)`,
            });
            setFinal("safe_stop", afterPos);
            return;
          }

          stepLogged = true;
          setStepCount(stepNum);
          onLogRef.current({
            timestamp: new Date().toLocaleTimeString(),
            message: `✅ Step ${stepNum}: Position ${afterPos.toFixed(1)}m | Traveled ${travelM.toFixed(1)}m this cycle | ${remainingM.toFixed(1)}m to wall | Latency ${actualLatencyMs.toFixed(0)}ms.`,
          });

          cloudStartPos = afterPos;
          cloudStepAccumS = 0;
          cloudNextLatencyS = jittered(cloudLatencyMs) / 1000;
        }

        // Sync position every frame for cloud (updates infrequently, so no perf concern)
        setPositionM(newPos);
      }

      animRef.current = requestAnimationFrame(animate);
    };

    // Log start
    onLogRef.current({
      timestamp: new Date().toLocaleTimeString(),
      message: currentMode === "cloud"
        ? `[START] AGV at 0m heading toward wall at ${totalDistanceM.toFixed(0)}m. Cloud latency ${formatLatency(latencyS)} (±20% jitter), clearance zone: last ${clearanceM.toFixed(1)}m.`
        : `[START] AGV at 0m heading toward wall at ${totalDistanceM.toFixed(0)}m. Edge reaction ${edgeReactionMs}ms, clearance zone: last ${clearanceM.toFixed(1)}m.`,
    });

    animRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [status, setFinal]);

  return { status, positionM, stepCount, start, reset };
}
