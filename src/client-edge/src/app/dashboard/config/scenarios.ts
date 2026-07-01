import { LLMBreakdownParams } from "../../shared/physics";

export type TrackId = "agv01" | "agv02" | "agv03";

export interface TrackConfig {
  label: string;
  cloudLatencyMs: number | "computed";
  llm?: LLMBreakdownParams;
  edgeLatencyMs: number | null;
  brakeLatencyMs: number;
}

export interface Scenario {
  id: string;
  label: string;
  oneLiner: string;
  tracks: Record<TrackId, TrackConfig>;
  shared: {
    agvSpeedMps: number;
    clearanceM: number;
    totalDistanceM: number;
  };
}

// Cloud LLM real throughput (2026): GPT-4o ~92 tok/s, GPT-4o-mini ~115 tok/s, Groq ~520 tok/s
// Blended rate (prompt+output) ≈ 120–200 for typical cloud, 300+ for fast inference
// AGV E2E safety requirement: 10–30ms loop; cloud-only control: 118–209ms (serverless study)
//
// Lean:  100 + ( 400/200)*1000 = 2100ms — safe, ~GPT-4o-mini speed
// Verbose: 100 + (2500/150)*1000 = 16767ms — crashes, ~GPT-4o speed with long output
const LEAN_LLM: LLMBreakdownParams = { networkRttMs: 100, promptTokens: 200, completionTokens: 200, tokenRateTokS: 200 };
const VERBOSE_LLM: LLMBreakdownParams = { networkRttMs: 100, promptTokens: 500, completionTokens: 2000, tokenRateTokS: 150 };

export const SCENARIOS: Scenario[] = [
  {
    id: "normal",
    label: "Normal Ops",
    oneLiner: "All three architectures survive under normal latency.",
    tracks: {
      agv01: { label: "Cloud-Only (Lean)", cloudLatencyMs: 800, edgeLatencyMs: null, brakeLatencyMs: 15 },
      agv02: { label: "Cloud + Edge",       cloudLatencyMs: 800, edgeLatencyMs: 20,   brakeLatencyMs: 15 },
      agv03: { label: "Cloud (Verbose)",    cloudLatencyMs: "computed", llm: LEAN_LLM, edgeLatencyMs: null, brakeLatencyMs: 15 },
    },
    shared: { agvSpeedMps: 1.0, clearanceM: 2.0, totalDistanceM: 10 },
  },
  {
    id: "cloud-spike",
    label: "Cloud Spike",
    oneLiner: "Network spike kills cloud-only. Edge Guardian saves the hybrid.",
    tracks: {
      agv01: { label: "Cloud-Only (Spike)", cloudLatencyMs: 5000, edgeLatencyMs: null, brakeLatencyMs: 15 },
      agv02: { label: "Cloud + Edge",        cloudLatencyMs: 5000, edgeLatencyMs: 20,   brakeLatencyMs: 15 },
      agv03: { label: "Cloud (Verbose)",     cloudLatencyMs: "computed", llm: LEAN_LLM, edgeLatencyMs: null, brakeLatencyMs: 15 },
    },
    shared: { agvSpeedMps: 1.0, clearanceM: 2.0, totalDistanceM: 10 },
  },
  {
    id: "verbose-llm",
    label: "Verbose LLM",
    oneLiner: "Network is fine, but the LLM talks too long. Cloud-only still dies.",
    tracks: {
      agv01: { label: "Cloud-Only (Lean)", cloudLatencyMs: 200, edgeLatencyMs: null, brakeLatencyMs: 15 },
      agv02: { label: "Cloud + Edge",       cloudLatencyMs: 200, edgeLatencyMs: 20,   brakeLatencyMs: 15 },
      agv03: { label: "Cloud (Verbose)",    cloudLatencyMs: "computed", llm: VERBOSE_LLM, edgeLatencyMs: null, brakeLatencyMs: 15 },
    },
    shared: { agvSpeedMps: 1.0, clearanceM: 2.0, totalDistanceM: 10 },
  },
  {
    id: "edge-disabled",
    label: "Edge Disabled",
    oneLiner: "Without edge fallback, every AGV crashes.",
    tracks: {
      agv01: { label: "Cloud-Only (Spike)", cloudLatencyMs: 5000, edgeLatencyMs: null, brakeLatencyMs: 15 },
      agv02: { label: "Cloud + Edge (Dead)", cloudLatencyMs: 5000, edgeLatencyMs: null, brakeLatencyMs: 15 },
      agv03: { label: "Cloud (Verbose)",    cloudLatencyMs: "computed", llm: VERBOSE_LLM, edgeLatencyMs: null, brakeLatencyMs: 15 },
    },
    shared: { agvSpeedMps: 1.0, clearanceM: 2.0, totalDistanceM: 10 },
  },
];

export type ScenarioId = (typeof SCENARIOS)[number]["id"];

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}
