"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KinematicParams, LogEntry, computeBrakingDistanceM } from "../lib/kinematic";

const JITTER_RANGE = 0.2;
function jittered(base: number): number {
  return base * (1 + (Math.random() * 2 - 1) * JITTER_RANGE);
}

type SimStatus = "idle" | "running" | "crashed" | "safe_stop";

interface UseCompareSimulationReturn {
  cloud: { status: SimStatus; positionM: number; stepCount: number };
  edge: { status: SimStatus; positionM: number };
  start: () => void;
  reset: () => void;
}

export function useCompareSimulation(
  params: KinematicParams,
  onLog: (entry: LogEntry) => void,
  showEdgeProgress: boolean = false,
): UseCompareSimulationReturn {
  const [cloudStatus, setCloudStatus] = useState<SimStatus>("idle");
  const [edgeStatus, setEdgeStatus] = useState<SimStatus>("idle");
  const [cloudPos, setCloudPos] = useState(0);
  const [edgePos, setEdgePos] = useState(0);
  const [stepCount, setStepCount] = useState(0);

  const paramsRef = useRef(params);
  const onLogRef = useRef(onLog);
  const showEdgeProgressRef = useRef(showEdgeProgress);
  const animRef = useRef<number | null>(null);
  const genRef = useRef(0);

  const cloudPosRef = useRef(0);
  const edgePosRef = useRef(0);
  const stepRef = useRef(0);
  const cloudStatusRef = useRef<SimStatus>("idle");
  const edgeStatusRef = useRef<SimStatus>("idle");

  paramsRef.current = params;
  onLogRef.current = onLog;
  showEdgeProgressRef.current = showEdgeProgress;

  const cleanup = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    genRef.current += 1;
    setCloudStatus("idle");
    setEdgeStatus("idle");
    setCloudPos(0);
    setEdgePos(0);
    setStepCount(0);
    cloudPosRef.current = 0;
    edgePosRef.current = 0;
    stepRef.current = 0;
    cloudStatusRef.current = "idle";
    edgeStatusRef.current = "idle";
  }, [cleanup]);

  const start = useCallback(() => {
    cleanup();
    genRef.current += 1;
    cloudPosRef.current = 0;
    edgePosRef.current = 0;
    stepRef.current = 0;
    cloudStatusRef.current = "running";
    edgeStatusRef.current = "running";
    setCloudPos(0);
    setEdgePos(0);
    setStepCount(0);
    setCloudStatus("running");
    setEdgeStatus("running");
  }, [cleanup]);

  // Use a dedicated runId to start/stop the loop without recreating on edge-status changes
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (cloudStatus === "running") {
      setRunId((n) => n + 1);
    }
  }, [cloudStatus === "running"]);

  useEffect(() => {
    if (runId === 0) return;
    if (cloudStatusRef.current !== "running") return;

    const { agvSpeedMps, totalDistanceM, clearanceM, cloudLatencyMs, edgeLatencyMs, brakeLatencyMs } = paramsRef.current;
    const clearanceBoundaryM = Math.max(0, totalDistanceM - clearanceM);
    const effectiveEdgeBoundaryM = clearanceBoundaryM + agvSpeedMps * edgeLatencyMs / 1000;
    const reactionS = brakeLatencyMs / 1000;
    const myGen = genRef.current;

    let lastTimestamp: number | null = null;
    let frameCount = 0;

    // Cloud step tracking
    let cloudAccumS = 0;
    let cloudNextS = jittered(cloudLatencyMs) / 1000;
    let cloudStepNum = 0;

    // Edge step tracking
    let edgeAccumS = 0;
    let edgeNextS = jittered(edgeLatencyMs) / 1000;
    let edgeStepNum = 0;

    const logBoth = (msg: string) => {
      onLogRef.current({ timestamp: new Date().toLocaleTimeString(), message: msg });
    };

    logBoth(`[START] Cloud vs Edge — ${agvSpeedMps.toFixed(1)}m/s, ${totalDistanceM.toFixed(0)}m track, ${clearanceM.toFixed(1)}m clearance. Edge: ${edgeLatencyMs}ms + brake ${brakeLatencyMs}ms.`);

    const animate = (timestamp: number) => {
      if (myGen !== genRef.current) return;
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const deltaS = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const newCloudPos = cloudStatusRef.current === "running"
        ? Math.min(cloudPosRef.current + agvSpeedMps * deltaS, totalDistanceM)
        : cloudPosRef.current;
      const newEdgePos = edgeStatusRef.current === "running"
        ? Math.min(edgePosRef.current + agvSpeedMps * deltaS, totalDistanceM)
        : edgePosRef.current;

      cloudPosRef.current = newCloudPos;
      edgePosRef.current = newEdgePos;

      // ---- Edge: step-based detection at edgeLatencyMs cadence ----
      if (edgeStatusRef.current === "running") {
        edgeAccumS += deltaS;
        if (edgeAccumS >= edgeNextS) {
          edgeStepNum += 1;
          const stepDurationS = edgeNextS;

          if (newEdgePos >= effectiveEdgeBoundaryM) {
            const brakingM = computeBrakingDistanceM(agvSpeedMps, reactionS);
            const finalPos = Math.min(newEdgePos + brakingM, totalDistanceM);
            if (finalPos >= totalDistanceM) {
              logBoth(`[EDGE] 💥 Detect at ${newEdgePos.toFixed(2)}m, brake ${brakingM.toFixed(3)}m exceeds remaining — crashed!`);
            } else {
              logBoth(`[EDGE] 🛡️ Detect at ${newEdgePos.toFixed(2)}m, brake ${brakingM.toFixed(3)}m → stop at ${finalPos.toFixed(3)}m. (latency ${edgeLatencyMs}ms + brake ${brakeLatencyMs}ms)`);
            }
            edgePosRef.current = finalPos;
            setEdgePos(finalPos);
            edgeStatusRef.current = "safe_stop";
            setEdgeStatus("safe_stop");
          } else if (newEdgePos >= totalDistanceM) {
            logBoth(`[EDGE] 💥 Reached wall — no obstacle detected!`);
            edgeStatusRef.current = "crashed";
            setEdgeStatus("crashed");
          } else if (showEdgeProgressRef.current) {
            logBoth(`[EDGE] ⚡ Step ${edgeStepNum}: ${newEdgePos.toFixed(2)}m, ${(totalDistanceM - newEdgePos).toFixed(2)}m to wall. (${(stepDurationS * 1000).toFixed(0)}ms)`);
          }

          edgeAccumS = 0;
          edgeNextS = jittered(edgeLatencyMs) / 1000;
        }
      }

      // ---- Cloud: step-based detection ----
      if (cloudStatusRef.current === "running") {
        cloudAccumS += deltaS;
        if (cloudAccumS >= cloudNextS) {
          cloudStepNum += 1;
          const stepNum = cloudStepNum;
          stepRef.current = stepNum;
          setStepCount(stepNum);
          const stepDurationS = cloudNextS;

          if (newCloudPos >= totalDistanceM) {
            logBoth(`[CLOUD] 💥 Step ${stepNum}: response at ${newCloudPos.toFixed(2)}m, already hit wall. (${(stepDurationS * 1000).toFixed(0)}ms)`);
            cloudStatusRef.current = "crashed";
            setCloudStatus("crashed");
          } else if (newCloudPos >= clearanceBoundaryM) {
            const brakingM = computeBrakingDistanceM(agvSpeedMps, reactionS);
            const finalPos = Math.min(newCloudPos + brakingM, totalDistanceM);
            logBoth(`[CLOUD] 🛡️ Step ${stepNum}: detected at ${newCloudPos.toFixed(2)}m, braked ${brakingM.toFixed(3)}m → stop at ${finalPos.toFixed(3)}m. (${(stepDurationS * 1000).toFixed(0)}ms)`);
            cloudPosRef.current = finalPos;
            setCloudPos(finalPos);
            cloudStatusRef.current = "safe_stop";
            setCloudStatus("safe_stop");
          } else {
            logBoth(`[CLOUD] ✅ Step ${stepNum}: ${newCloudPos.toFixed(2)}m, ${(totalDistanceM - newCloudPos).toFixed(2)}m to wall. (${(stepDurationS * 1000).toFixed(0)}ms)`);
          }

          cloudAccumS = 0;
          cloudNextS = jittered(cloudLatencyMs) / 1000;
        }
      }

      frameCount += 1;
      if (frameCount % 3 === 0) {
        setCloudPos(cloudPosRef.current);
        setEdgePos(edgePosRef.current);
      }

      if (cloudStatusRef.current !== "running" && edgeStatusRef.current !== "running") {
        setCloudPos(cloudPosRef.current);
        setEdgePos(edgePosRef.current);
        return;
      }

      if (myGen === genRef.current) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); };
  }, [runId]);

  return {
    cloud: { status: cloudStatus, positionM: cloudPos, stepCount },
    edge: { status: edgeStatus, positionM: edgePos },
    start, reset,
  };
}
