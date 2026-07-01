"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KinematicParams, KinematicResult, LogEntry, Mode } from "../lib/kinematic";

interface UseKinematicSimulationOptions {
  params: KinematicParams;
  result: KinematicResult;
  mode: Mode;
  onLog: (entry: LogEntry) => void;
}

interface UseKinematicSimulationReturn {
  isRunning: boolean;
  agvOffsetPercent: number;
  hasCrashed: boolean;
  hasStopped: boolean;
  start: () => void;
  reset: () => void;
}

export function useKinematicSimulation({
  params,
  result,
  mode,
  onLog,
}: UseKinematicSimulationOptions): UseKinematicSimulationReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [agvOffsetPercent, setAgvOffsetPercent] = useState(0);
  const [hasCrashed, setHasCrashed] = useState(false);
  const [hasStopped, setHasStopped] = useState(false);

  const animationRef = useRef<number | null>(null);

  // Use refs to access latest values inside the animation loop without
  // recreating the effect on every parameter change.
  const paramsRef = useRef(params);
  const resultRef = useRef(result);
  const modeRef = useRef(mode);
  const onLogRef = useRef(onLog);
  const hasCrashedRef = useRef(hasCrashed);
  const hasStoppedRef = useRef(hasStopped);

  paramsRef.current = params;
  resultRef.current = result;
  modeRef.current = mode;
  onLogRef.current = onLog;
  hasCrashedRef.current = hasCrashed;
  hasStoppedRef.current = hasStopped;

  const reset = useCallback(() => {
    setIsRunning(false);
    setAgvOffsetPercent(0);
    setHasCrashed(false);
    setHasStopped(false);
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
    const modeLabel = modeRef.current === "cloud" ? "Cloud-Only" : "Edge Fallback";
    onLogRef.current({
      timestamp: new Date().toLocaleTimeString(),
      message: `[KINEMATIC] Starting ${modeLabel} simulation. V_agv=${paramsRef.current.agvSpeedMps.toFixed(
        1
      )}m/s, clearance=${paramsRef.current.clearanceM.toFixed(1)}m.`,
    });
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const currentParams = paramsRef.current;
    const currentResult = resultRef.current;
    const currentMode = modeRef.current;
    const currentOnLog = onLogRef.current;

    const clearanceCm = currentParams.clearanceM * 100;
    const trackLengthCm = Math.max(clearanceCm * 1.5, 100);
    const wallPercent = (clearanceCm / trackLengthCm) * 100;
    const { latencySeconds, vMaxMps, brakingDistanceCm } = currentResult;
    const stopPercent = Math.min(wallPercent, (brakingDistanceCm / trackLengthCm) * 100);

    let startTime: number | null = null;
    const speedPercentPerMs = (currentParams.agvSpeedMps * 100) / trackLengthCm / 1000;

    const tick = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const next = Math.min(100, elapsed * speedPercentPerMs);

      if (currentMode === "cloud") {
        if (next >= wallPercent && !hasCrashedRef.current) {
          setAgvOffsetPercent(wallPercent);
          setHasCrashed(true);
          setIsRunning(false);
          currentOnLog({
            timestamp: new Date().toLocaleTimeString(),
            message: `💥 [THEOREM VIOLATION] Cloud-only latency ${formatLatency(
              latencySeconds
            )} exceeds braking distance ${brakingDistanceCm.toFixed(
              1
            )}cm. V_agv=${currentParams.agvSpeedMps.toFixed(
              1
            )}m/s > V_max=${vMaxMps.toFixed(2)}m/s. Collision!`,
          });
          return;
        }
      } else {
        if (next >= stopPercent && !hasStoppedRef.current) {
          setAgvOffsetPercent(stopPercent);
          setHasStopped(true);
          setIsRunning(false);
          currentOnLog({
            timestamp: new Date().toLocaleTimeString(),
            message: `🛡️ [EDGE BYPASS] Ultrasonic/LiDAR short-circuit engaged within ${formatLatency(
              latencySeconds
            )}. Braking distance ${brakingDistanceCm.toFixed(
              1
            )}cm. V_agv=${currentParams.agvSpeedMps.toFixed(1)}m/s ≤ V_max=${vMaxMps.toFixed(
              2
            )}m/s. Safe stop.`,
          });
          return;
        }
      }

      setAgvOffsetPercent(next);
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isRunning]);

  return {
    isRunning,
    agvOffsetPercent,
    hasCrashed,
    hasStopped,
    start,
    reset,
  };
}

function formatLatency(seconds: number): string {
  if (seconds < 0.001) return `${(seconds * 1000).toFixed(2)} ms`;
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  return `${seconds.toFixed(2)} s`;
}
