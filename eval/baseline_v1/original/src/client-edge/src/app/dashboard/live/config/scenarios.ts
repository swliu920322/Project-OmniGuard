// Scenario presets for the live page.
//
// A preset sets the settings (obstacle distance, speed) AND the car's starting state
// (HP, battery, temperature), and states which pipeline path the backend should take.
// Each Start / single step puts the car back to this starting state.

export type ExitPath = "full" | "safety_block" | "router_skip" | "physical_halt";

export type ScenarioId = "normal" | "worker" | "cargo" | "overheat" | "lowBattery" | "deadlock";

export interface LiveScenario {
  id: ScenarioId;
  icon: string;
  /** English name for the audit log (the UI label comes from the i18n tables). */
  logName: string;
  setup: {
    distanceCm: number; // obstacle distance setting
    speedMps: number; // starting speed
    hp: number;
    battery: number; // %
    temperatureC: number;
  };
  expect: ExitPath;
  /** The expected path depends on the model's judgement rather than on a hard-coded rule. */
  modelDependent?: boolean;
}

const BASE = { distanceCm: 80, speedMps: 0.5, hp: 100, battery: 100, temperatureC: 40 };

export const LIVE_SCENARIOS: LiveScenario[] = [
  { id: "normal", icon: "✅", logName: "Normal", setup: { ...BASE }, expect: "full" },
  // Closer than the 30cm safety limit: the Safety agent should block.
  { id: "worker", icon: "👷", logName: "Worker appears (12cm, 1.8m/s)", setup: { ...BASE, distanceCm: 12, speedMps: 1.8 }, expect: "safety_block" },
  { id: "cargo", icon: "📦", logName: "Fallen cargo (28cm)", setup: { ...BASE, distanceCm: 28 }, expect: "safety_block" },
  // 85C is above the 60C limit: the Router is expected to flag a sensor/hardware fault.
  { id: "overheat", icon: "🔥", logName: "Overheating (85C)", setup: { ...BASE, temperatureC: 85 }, expect: "router_skip", modelDependent: true },
  // Hard gates in the backend: no model is called at all.
  { id: "lowBattery", icon: "🪫", logName: "Low battery (3%)", setup: { ...BASE, battery: 3 }, expect: "physical_halt" },
  { id: "deadlock", icon: "💀", logName: "Hardware deadlock (HP 0)", setup: { ...BASE, hp: 0 }, expect: "physical_halt" },
];

export function getScenario(id: ScenarioId): LiveScenario {
  return LIVE_SCENARIOS.find((s) => s.id === id) ?? LIVE_SCENARIOS[0];
}
