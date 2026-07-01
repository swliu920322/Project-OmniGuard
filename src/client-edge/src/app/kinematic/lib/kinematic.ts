export type Mode = "cloud" | "edge";

export interface KinematicParams {
  agvSpeedMps: number;
  clearanceM: number;
  totalDistanceM: number;
  cloudLatencyMs: number;
  edgeLatencyMs: number;
  brakeLatencyMs: number;
}

export interface SliderConfig {
  key: keyof KinematicParams;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  category: "physical" | "robot" | "cloud" | "edge";
}

export interface LogEntry {
  timestamp: string;
  message: string;
}

export const DEFAULT_PARAMS: KinematicParams = {
  agvSpeedMps: 1.0,
  clearanceM: 2.0,
  totalDistanceM: 10,
  cloudLatencyMs: 3000,
  edgeLatencyMs: 20,
  brakeLatencyMs: 15,
};

export const SLIDERS: SliderConfig[] = [
  { key: "agvSpeedMps", label: "AGV Speed", unit: "m/s", min: 0.1, max: 3.0, step: 0.1, category: "physical" },
  { key: "clearanceM", label: "Safety Clearance", unit: "m", min: 0.1, max: 10.0, step: 0.1, category: "physical" },
  { key: "totalDistanceM", label: "Track Length", unit: "m", min: 5, max: 50, step: 1, category: "physical" },
  { key: "brakeLatencyMs", label: "Brake Latency", unit: "ms", min: 1, max: 200, step: 1, category: "robot" },
  { key: "cloudLatencyMs", label: "Cloud Latency", unit: "ms", min: 500, max: 30000, step: 100, category: "cloud" },
  { key: "edgeLatencyMs", label: "Edge Latency", unit: "ms", min: 1, max: 500, step: 1, category: "edge" },
];

import { brakingDistanceM } from "../../shared/physics";

/** @deprecated Use brakingDistanceM from shared/physics directly. This alias preserves imports. */
export const computeBrakingDistanceM = brakingDistanceM;

export function formatLatency(seconds: number): string {
  if (seconds < 0.001) return `${(seconds * 1000).toFixed(2)} ms`;
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  return `${seconds.toFixed(2)} s`;
}

export interface Preset {
  label: string;
  desc: string;
  params: KinematicParams;
  mode: Mode;
}

export const PRESETS: Preset[] = [
  {
    label: "Warehouse AGV",
    desc: "1.5m/s, 3s cloud, 1m clearance — collides within 2 cycles",
    params: { agvSpeedMps: 1.5, clearanceM: 1.0, totalDistanceM: 10, cloudLatencyMs: 3000, edgeLatencyMs: 20, brakeLatencyMs: 15 },
    mode: "cloud",
  },
  {
    label: "Hospital Delivery",
    desc: "0.8m/s, 2s cloud, 0.5m clearance — tight corridor, immediate danger",
    params: { agvSpeedMps: 0.8, clearanceM: 0.5, totalDistanceM: 8, cloudLatencyMs: 2000, edgeLatencyMs: 15, brakeLatencyMs: 10 },
    mode: "cloud",
  },
  {
    label: "Highway Drone",
    desc: "5m/s, 5s cloud, 10m clearance — high speed, long braking",
    params: { agvSpeedMps: 5.0, clearanceM: 10.0, totalDistanceM: 50, cloudLatencyMs: 5000, edgeLatencyMs: 10, brakeLatencyMs: 5 },
    mode: "cloud",
  },
  {
    label: "Default (Demo)",
    desc: "1m/s, 3s cloud, 2m clearance — standard classroom demo",
    params: DEFAULT_PARAMS,
    mode: "cloud",
  },
];
