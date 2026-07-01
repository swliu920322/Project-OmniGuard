// API layer for the Fleet Dashboard simulation endpoint.
// Pure construction + fetch helpers; no React state.

import { JITTER_DELAY_MS } from "../config/simulation";

export interface PipelineStep {
  agent: string;
  decision: string;
  status?: "PASS" | "BLOCKED" | "SHORT_CIRCUIT" | "COMPILED";
}

export interface SimulateResponse {
  latency_ms: number;
  final_action: Array<Record<string, any>>;
  pipeline_trace: PipelineStep[];
  cloud_metrics?: {
    cosmos_db_ru_charge: number;
    cosmos_write_latency_ms: number;
    execution_environment: string;
    vnet_isolation: string;
    iot_hub_routing: string;
  };
}

export interface OverrideConfig {
  agent_router_prompt: string;
  agent_safety_rules: string;
  agent_execution_schema: string;
}

export interface SimulationSnapshot {
  tenant_id: string;
  obstacle_distance_cm: number;
  current_x: number;
  target_speed: number;
  velocity: number;
  hp: number;
  battery: number;
  temperature: number;
}

/** Build the POST body for /api/simulate_agent/ from a fleet snapshot + prompt overrides. */
export function buildSimulationPayload(
  snapshot: SimulationSnapshot,
  override: OverrideConfig
): Record<string, unknown> {
  return {
    tenant_id: snapshot.tenant_id,
    obstacle_distance_cm: snapshot.obstacle_distance_cm,
    current_x: snapshot.current_x,
    target_speed: snapshot.target_speed,
    velocity: snapshot.velocity,
    hp: snapshot.hp,
    battery: snapshot.battery,
    temperature: snapshot.temperature,
    override_config: {
      agent_router_prompt: override.agent_router_prompt,
      agent_safety_rules: override.agent_safety_rules,
      agent_execution_schema: override.agent_execution_schema,
    },
  };
}

/** Latency as observed by the physics layer, including the jitter spike when enabled. */
export function computeActualLatencyMs(latencyMs: number, jitterEnabled: boolean): number {
  return latencyMs + (jitterEnabled ? JITTER_DELAY_MS : 0);
}

/** POST to the simulation endpoint and return the parsed response. Throws on non-2xx. */
export async function fetchSimulation(payload: Record<string, unknown>): Promise<SimulateResponse> {
  const res = await fetch("/api/simulate_agent/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Server returned error status: ${res.status}`);
  }

  return (await res.json()) as SimulateResponse;
}
