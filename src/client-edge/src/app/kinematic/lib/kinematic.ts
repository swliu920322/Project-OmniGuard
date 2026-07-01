export type Mode = "cloud" | "edge";

export interface KinematicParams {
  agvSpeedMps: number;
  clearanceM: number;
  totalDistanceM: number;
  cloudLatencyMs: number;
  edgeReactionMs: number;
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

export interface LogEntry {
  timestamp: string;
  message: string;
}

export const DEFAULT_PARAMS: KinematicParams = {
  agvSpeedMps: 1.0,
  clearanceM: 2.0,
  totalDistanceM: 50,
  cloudLatencyMs: 13000,
  edgeReactionMs: 15,
};

export const SLIDERS: SliderConfig[] = [
  { key: "agvSpeedMps", label: "AGV Speed", unit: "m/s", min: 0.1, max: 3.0, step: 0.1, category: "physical" },
  { key: "clearanceM", label: "Safety Clearance", unit: "m", min: 0.1, max: 10.0, step: 0.1, category: "physical" },
  { key: "totalDistanceM", label: "Track Length", unit: "m", min: 10, max: 200, step: 5, category: "physical" },
  { key: "cloudLatencyMs", label: "Cloud Latency", unit: "ms", min: 500, max: 30000, step: 100, category: "cloud" },
  { key: "edgeReactionMs", label: "Edge Reaction", unit: "ms", min: 1, max: 100, step: 1, category: "edge" },
];

export function computeBrakingDistanceM(speedMps: number, latencySeconds: number): number {
  return speedMps * latencySeconds;
}

export function formatLatency(seconds: number): string {
  if (seconds < 0.001) return `${(seconds * 1000).toFixed(2)} ms`;
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  return `${seconds.toFixed(2)} s`;
}
