// Pure helpers that read a backend response and say which pipeline path it took.

import type { ExitPath } from "../config/scenarios";
import type { PipelineStep, SimulateResponse } from "./simulation";

function find(trace: PipelineStep[], agent: string): PipelineStep | undefined {
  return trace.find((step) => step.agent === agent);
}

const isSkipped = (step?: PipelineStep) => !step || step.decision === "SKIPPED" || step.status === "SHORT_CIRCUIT";

/** Which path the pipeline took: a hard gate, the Router, the Safety agent, or all three agents. */
export function classifyExit(response: Pick<SimulateResponse, "pipeline_trace"> | null): ExitPath | null {
  if (!response) return null;
  const trace = response.pipeline_trace;
  const router = find(trace, "Router");
  const safety = find(trace, "Safety");
  const compiler = find(trace, "Action Compiler");
  if (!router) return null;

  // Backend hard gates (HP <= 0 or battery < 5) answer without calling any model.
  if (router.status === "SHORT_CIRCUIT" || router.decision.startsWith("SHORT_CIRCUIT")) return "physical_halt";
  if (isSkipped(safety)) return "router_skip";
  if (safety?.status === "BLOCKED") return "safety_block";
  if (compiler?.status === "COMPILED") return "full";
  return null;
}

/** How many model calls produced this response. */
export function countModelCalls(response: Pick<SimulateResponse, "pipeline_trace"> | null): number {
  if (!response) return 0;
  const trace = response.pipeline_trace;
  if (classifyExit(response) === "physical_halt") return 0;
  return ["Router", "Safety", "Action Compiler"].filter((agent) => !isSkipped(find(trace, agent))).length;
}
