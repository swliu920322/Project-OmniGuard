// Pure decision handling for the Fleet Dashboard.
//
// The AGV's motion is NOT computed here: a separate real-time loop (see
// hooks/useFleetSimulation.ts) moves it at its current velocity while the cloud request is in
// flight. When the response arrives, applyDecision() only applies what the decision changes
// (new velocity command, temperature, battery, logs) to the fleet state as it is *now*.
// It never reads React state, which keeps it testable and side-effect free.

import {
  BATTERY_BASE_DRAIN,
  BATTERY_OVERHEAT_DRAIN,
  BATTERY_STOP_DRAIN,
  BATTERY_TURN_DRAIN,
  DEFAULT_ACTION_SPEED,
  HIGH_LOAD_SPEED,
  HIGH_LOAD_VELOCITY,
  LOW_BATTERY_THRESHOLD,
  TEMP_BASELINE,
  TEMP_HEATUP,
  TEMP_HIGH_SPEED_THRESHOLD,
  TEMP_MAX,
  TEMP_OVERHEAT_THRESHOLD,
  TEMP_RECOVERY_NORMAL,
  TEMP_RECOVERY_OVERHEAT,
} from "../config/simulation";
import { computeActualLatencyMs, SimulateResponse } from "./simulation";

export interface FleetState {
  hp: number;
  battery: number;
  velocity: number;
  temperature: number;
  distance: number; // live gap to the obstacle (cm), not the configured distance
  currentX: number;
}

export interface PhysicsStepResult {
  state: FleetState; // new state to apply
  isCollided: boolean;
  isBlocked: boolean;
  logs: string[];
  shouldContinue: boolean; // whether the autopilot loop may schedule another step
}

/** What happened while the request was in flight (measured by the motion loop). */
export interface DecisionWait {
  speedMps: number; // velocity when the request was sent
  gapAtSendCm: number; // obstacle gap when the telemetry snapshot was taken
  slidingCm: number; // distance travelled while waiting for the decision
  collidedWhileWaiting: boolean; // the AGV hit the obstacle before the decision arrived
}

type FinalAction = Record<string, any>;

function findMoveAction(finalAction: FinalAction[]): FinalAction | undefined {
  return finalAction.find((act) => act.action === "move");
}

/**
 * Temperature transition for one step.
 * Returns the new temperature and whether the overheating/high-load thermal
 * throttle applies (which adds extra battery drain in that branch only).
 */
export function calculateTemperatureChange(
  state: FleetState,
  finalAction: FinalAction[],
  moveAction: FinalAction | undefined
): { newTemp: number; thermalThrottleDrain: boolean } {
  const oldTemp = state.temperature;

  if (oldTemp > TEMP_OVERHEAT_THRESHOLD) {
    const speed = moveAction ? moveAction.speed || DEFAULT_ACTION_SPEED : 0;
    if (state.velocity > HIGH_LOAD_VELOCITY || speed > HIGH_LOAD_SPEED) {
      // High load while overheated: no cool-down, just extra battery drain.
      return { newTemp: oldTemp, thermalThrottleDrain: true };
    }
    return {
      newTemp: Math.max(TEMP_BASELINE, oldTemp - TEMP_RECOVERY_OVERHEAT),
      thermalThrottleDrain: false,
    };
  }

  if (finalAction.some((a) => a.action === "move" && (a.speed || DEFAULT_ACTION_SPEED) > TEMP_HIGH_SPEED_THRESHOLD)) {
    return { newTemp: Math.min(TEMP_MAX, oldTemp + TEMP_HEATUP), thermalThrottleDrain: false };
  }
  return { newTemp: Math.max(TEMP_BASELINE, oldTemp - TEMP_RECOVERY_NORMAL), thermalThrottleDrain: false };
}

/** Battery drain for one step, given the actions taken and thermal throttle flag. */
export function calculateBatteryDrain(
  finalAction: FinalAction[],
  thermalThrottleDrain: boolean
): number {
  let drain = BATTERY_BASE_DRAIN;
  if (finalAction.some((a) => a.action === "stop" || a.action === "emergency_halt")) {
    drain += BATTERY_STOP_DRAIN;
  }
  if (finalAction.some((a) => a.action === "turn" || a.action === "reverse")) {
    drain += BATTERY_TURN_DRAIN;
  }
  if (thermalThrottleDrain) {
    drain += BATTERY_OVERHEAT_DRAIN;
  }
  return drain;
}

/** Builds the [DECISION] / [PHYSICS] / [WARNING] log lines for a decision. */
export function buildPhysicsLogs(
  derived: { newHp: number; newBattery: number; newTemp: number },
  response: SimulateResponse,
  actualLatencyMs: number,
  moveAction: FinalAction | undefined,
  wait: DecisionWait,
  isBlocked: boolean
): string[] {
  const finalAction = response.final_action;
  const { newHp, newBattery, newTemp } = derived;

  const logs: string[] = [];
  const actionDesc = moveAction
    ? `MOVE (${moveAction.speed || DEFAULT_ACTION_SPEED}cm/s)`
    : finalAction[0]?.action?.toUpperCase() || "HALT";
  logs.push(`[DECISION] C2D Action: ${actionDesc} | Latency: ${actualLatencyMs}ms`);

  let physicsOutcome = "";
  if (wait.collidedWhileWaiting) {
    physicsOutcome = `💥 [COLLISION] Impact! The decision arrived too late. HP reduced to ${newHp}.`;
  } else if (newHp <= 0) {
    physicsOutcome = `💀 [DEADLOCK] Hardware disabled (HP=0).`;
  } else if (newBattery < LOW_BATTERY_THRESHOLD) {
    physicsOutcome = `🪫 [LOW BATTERY] Critically low power (Battery=${newBattery.toFixed(0)}%).`;
  } else if (isBlocked) {
    physicsOutcome = `🛡️ [SAFETY HALT] Strategic Stop triggered. Stopped safely.`;
  } else {
    physicsOutcome = `✅ [NORMAL] Moving forward safely.`;
  }

  logs.push(
    `[PHYSICS] V: ${wait.speedMps.toFixed(2)}m/s | Sliding: ${wait.slidingCm.toFixed(1)}cm | Gap: ${wait.gapAtSendCm.toFixed(0)}cm | Temp: ${newTemp}°C | ${physicsOutcome}`
  );

  if (newTemp > TEMP_OVERHEAT_THRESHOLD) {
    logs.push(`[WARNING] Core Temp ${newTemp}°C is high! Thermal throttle active (Extra battery drain).`);
  }

  return logs;
}

/**
 * Apply a cloud decision to the fleet as it is at the moment the response arrives.
 * `state` is the live state (the motion loop has already moved the AGV while waiting);
 * `wait` describes what happened during that time. Pure: returns new state + logs.
 */
export function applyDecision(
  state: FleetState,
  response: SimulateResponse,
  jitterEnabled: boolean,
  wait: DecisionWait
): PhysicsStepResult {
  const finalAction = response.final_action;
  const actualLatencyMs = computeActualLatencyMs(response.latency_ms, jitterEnabled);
  const isBlocked = response.pipeline_trace.some((step) => step.status === "BLOCKED");
  const moveAction = findMoveAction(finalAction);
  const isCollided = wait.collidedWhileWaiting;

  // Temperature transition (may flag thermal throttle)
  const { newTemp, thermalThrottleDrain } = calculateTemperatureChange(state, finalAction, moveAction);

  // Battery drain
  const newBattery = Math.max(0, state.battery - calculateBatteryDrain(finalAction, thermalThrottleDrain));

  const logs = buildPhysicsLogs(
    { newHp: state.hp, newBattery, newTemp },
    response,
    actualLatencyMs,
    moveAction,
    wait,
    isBlocked
  );

  const shouldContinue = !(
    state.hp <= 0 ||
    newBattery < LOW_BATTERY_THRESHOLD ||
    isBlocked ||
    isCollided ||
    !moveAction
  );

  // The decision is a velocity command: "move" sets the speed, anything else stops the AGV.
  const commandedVelocity = moveAction ? (moveAction.speed || DEFAULT_ACTION_SPEED) / 100 : 0;

  return {
    state: {
      ...state,
      battery: newBattery,
      temperature: newTemp,
      velocity: shouldContinue && !isCollided ? commandedVelocity : 0,
    },
    isCollided,
    isBlocked,
    logs,
    shouldContinue,
  };
}
