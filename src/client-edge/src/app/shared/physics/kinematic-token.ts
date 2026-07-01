// Shared physics kernel — pure math for the Kinematic-Token Theorem.
// Used by both /kinematic and /dashboard. Zero React, zero side effects.

export interface LLMBreakdownParams {
  networkRttMs: number;
  promptTokens: number;
  completionTokens: number;
  tokenRateTokS: number;
}

/** Total cloud detection latency combining network RTT + LLM generation. */
export function computeCloudLatencyMs(b: LLMBreakdownParams): number {
  return b.networkRttMs + ((b.promptTokens + b.completionTokens) / b.tokenRateTokS) * 1000;
}

/** Distance traveled during brake engagement at a given speed. */
export function brakingDistanceM(speedMps: number, brakeLatencyS: number): number {
  return speedMps * brakeLatencyS;
}

/** Distance traveled during an unchecked latency window. */
export function slideDistanceM(speedMps: number, latencyS: number): number {
  return speedMps * latencyS;
}

/** Total control loop latency in seconds. */
export function totalLoopLatencyS(detectionLatencyS: number, brakeLatencyS: number): number {
  return detectionLatencyS + brakeLatencyS;
}

/** Maximum safe speed given clearance and loop latency. */
export function vMaxMps(clearanceM: number, loopLatencyS: number): number {
  if (loopLatencyS <= 0) return Infinity;
  return clearanceM / loopLatencyS;
}

/** Is the AGV safe given current speed, clearance, and latencies? */
export function isSafe(
  speedMps: number,
  clearanceM: number,
  detectionLatencyS: number,
  brakeLatencyS: number,
): boolean {
  return speedMps <= vMaxMps(clearanceM, totalLoopLatencyS(detectionLatencyS, brakeLatencyS));
}
