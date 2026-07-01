// Centralized simulation constants and tenant configuration for the Fleet Dashboard.
// Extracted from page.tsx to remove magic numbers and keep a single source of truth.

// ---- Timing / latency -------------------------------------------------------
export const JITTER_DELAY_MS = 2500; // Network jitter simulation spike
export const AUTOPILOT_INTERVAL_MS = 800; // Delay between autopilot cycles (after each step completes)
export const LATENCY_HIGH_THRESHOLD_MS = 2000; // Above this the latency gauge turns red
export const DEFAULT_DISPLAY_LATENCY_MS = 800; // Latency shown in the visualizer before any response arrives

// ---- Battery ---------------------------------------------------------------
export const BATTERY_BASE_DRAIN = 0.6; // Base drain per step
export const BATTERY_STOP_DRAIN = 2.0; // Extra drain when stopping / emergency halt
export const BATTERY_TURN_DRAIN = 1.2; // Extra drain when turning / reversing
export const BATTERY_OVERHEAT_DRAIN = 3.0; // Rapid drain under high load while overheated
export const LOW_BATTERY_THRESHOLD = 5; // Below this autopilot stops

// ---- Temperature -----------------------------------------------------------
export const TEMP_BASELINE = 40; // Recovery floor (°C)
export const TEMP_OVERHEAT_THRESHOLD = 60; // Above this thermal throttle kicks in
export const TEMP_MAX = 100; // Hard ceiling (°C)
export const TEMP_HIGH_SPEED_THRESHOLD = 60; // move speed above this heats the motor
export const TEMP_RECOVERY_OVERHEAT = 4; // Cool-down when overheated but low load
export const TEMP_RECOVERY_NORMAL = 1; // Cool-down under normal operation
export const TEMP_HEATUP = 3; // Heat-up when moving fast

// ---- Physics ---------------------------------------------------------------
export const HP_COLLISION_DAMAGE = 50; // HP lost on collision
export const DEFAULT_ACTION_SPEED = 50; // Fallback speed (cm/s) when action.speed is missing
export const HIGH_LOAD_VELOCITY = 0.5; // m/s threshold for "high load" thermal drain
export const HIGH_LOAD_SPEED = 20; // cm/s threshold for "high load" thermal drain

// ---- Default prompt overrides per tenant -----------------------------------
export interface TenantPromptConfig {
  router: string;
  safety: string;
  schema: string;
}

export const DEFAULT_CONFIGS: Record<string, TenantPromptConfig> = {
  "Tenant-Alpha": {
    router: "Classify telemetry into: [CRITICAL_OBSTACLE, NORMAL_NAV, SENSOR_ERROR]. Return ONLY the classification string.",
    safety: "Strict Rule: Actions MUST NOT include 'spray_water' or 'fast_forward'. Maintain 30cm minimum distance.",
    schema: "[{'action': 'stop'|'turn'|'move', 'degree': int, 'speed': int}]"
  },
  "Tenant-Beta": {
    router: "Classify telemetry into: [HUMAN_DETECTED, STATIC_OBSTACLE, EMERGENCY]. Return ONLY the classification string.",
    safety: "Strict Rule: If HUMAN_DETECTED, the only allowed action is 'stop'. No bypassing.",
    schema: "[{'action': 'stop'|'backward'|'voice_alert', 'speed': int}]"
  }
};

// ---- Tenant scenario descriptors (UI copy) ---------------------------------
export interface TenantScenario {
  name: string;
  desc: string;
  triggerDist: string;
}

export const TENANT_SCENARIOS: Record<string, TenantScenario> = {
  "Tenant-Alpha": {
    name: "Data Center Patrol",
    desc: "Critical fire/obstacle detection. Block action below 30cm limit.",
    triggerDist: "30cm"
  },
  "Tenant-Beta": {
    name: "Hospital Delivery",
    desc: "Emergency safety stop. Force block on human detection.",
    triggerDist: "human detected / critical block"
  }
};
