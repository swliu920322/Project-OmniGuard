export type Mode = "cloud" | "edge";

export interface KinematicParams {
  agvSpeedMps: number;          // Shared: robot speed
  clearanceM: number;           // Shared: obstacle clearance
  networkRttMs: number;         // Cloud only
  tokenRate: number;            // Cloud only
  promptTokens: number;         // Cloud only
  completionTokens: number;     // Cloud only
  edgeReactionMs: number;       // Edge only
}

export interface KinematicResult {
  latencySeconds: number;       // Total control-loop delay for the active mode
  vMaxMps: number;              // Maximum safe speed for the active mode
  isSafe: boolean;              // Whether current V_agv is within the safe bound
  brakingDistanceCm: number;    // Distance travelled during the delay
}

export interface LogEntry {
  timestamp: string;
  message: string;
}

export interface SliderConfig {
  key: keyof KinematicParams;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  category: "physical" | "cloud" | "edge";
}

export const DEFAULT_PARAMS: KinematicParams = {
  agvSpeedMps: 1.0,
  clearanceM: 2.0,
  networkRttMs: 800,
  tokenRate: 50,
  promptTokens: 500,
  completionTokens: 100,
  edgeReactionMs: 15,
};

export const SLIDERS: SliderConfig[] = [
  // Shared physical parameters (visible in both tabs)
  { key: "agvSpeedMps", label: "AGV Current Speed", unit: "m/s", min: 0.1, max: 3.0, step: 0.1, category: "physical" },
  { key: "clearanceM", label: "Safety Clearance", unit: "m", min: 0.1, max: 5.0, step: 0.1, category: "physical" },
  // Cloud-only parameters
  { key: "networkRttMs", label: "Network RTT", unit: "ms", min: 20, max: 2000, step: 10, category: "cloud" },
  { key: "tokenRate", label: "LLM Token Rate", unit: "tokens/s", min: 10, max: 150, step: 5, category: "cloud" },
  { key: "promptTokens", label: "Prompt Tokens", unit: "tokens", min: 50, max: 2000, step: 50, category: "cloud" },
  { key: "completionTokens", label: "Completion Tokens", unit: "tokens", min: 10, max: 500, step: 10, category: "cloud" },
  // Edge-only parameters
  { key: "edgeReactionMs", label: "Edge Reaction Time", unit: "ms", min: 1, max: 100, step: 1, category: "edge" },
];

export function computeKinematicResult(params: KinematicParams, mode: Mode): KinematicResult {
  let latencySeconds: number;

  if (mode === "cloud") {
    const networkLatencySeconds = params.networkRttMs / 1000;
    // Guard against zero/negative token rate (would yield Infinity/NaN latency).
    const inferenceLatencySeconds =
      params.tokenRate > 0
        ? (params.promptTokens + params.completionTokens) / params.tokenRate
        : Infinity;
    latencySeconds = networkLatencySeconds + inferenceLatencySeconds;
  } else {
    latencySeconds = params.edgeReactionMs / 1000;
  }

  // Defensive guards: a non-positive clearance or latency makes the safe-speed
  // bound meaningless. Fall back to an unsafe result instead of NaN/Infinity.
  const clearanceValid = Number.isFinite(params.clearanceM) && params.clearanceM > 0;
  const latencyValid = Number.isFinite(latencySeconds) && latencySeconds > 0;

  if (!clearanceValid || !latencyValid) {
    return {
      latencySeconds,
      vMaxMps: 0,
      isSafe: false,
      brakingDistanceCm: latencyValid ? params.agvSpeedMps * latencySeconds * 100 : Infinity,
    };
  }

  const vMaxMps = params.clearanceM / latencySeconds;
  const brakingDistanceCm = params.agvSpeedMps * latencySeconds * 100;

  return {
    latencySeconds,
    vMaxMps,
    isSafe: params.agvSpeedMps <= vMaxMps,
    brakingDistanceCm,
  };
}

export function formatLatency(seconds: number): string {
  if (seconds < 0.001) return `${(seconds * 1000).toFixed(2)} ms`;
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  return `${seconds.toFixed(2)} s`;
}
