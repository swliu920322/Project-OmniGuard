// Pure physics step for the Fleet Dashboard.
//
// IMPORTANT semantics: every read uses the *old* fleet snapshot (velocity,
// temperature, distance as they were at the start of the step). The function
// returns the new state for the caller to apply in one batch. It never reads
// "current" React state — that is what makes it testable and side-effect free.

import {
  BATTERY_BASE_DRAIN,
  BATTERY_OVERHEAT_DRAIN,
  BATTERY_STOP_DRAIN,
  BATTERY_TURN_DRAIN,
  DEFAULT_ACTION_SPEED,
  HIGH_LOAD_SPEED,
  HIGH_LOAD_VELOCITY,
  HP_COLLISION_DAMAGE,
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
  distance: number;
  currentX: number;
}

export interface PhysicsStepResult {
  state: FleetState; // new state to apply
  isCollided: boolean;
  isBlocked: boolean;
  logs: string[];
  shouldContinue: boolean; // whether the autopilot loop may schedule another step
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

/** Builds the [DECISION] / [PHYSICS] / [WARNING] log lines for a step. Wording is verbatim from the original UI. */
export function buildPhysicsLogs(
  oldState: FleetState,
  derived: { newHp: number; newBattery: number; newTemp: number },
  response: SimulateResponse,
  actualLatencyMs: number,
  moveAction: FinalAction | undefined,
  isCollided: boolean,
  isBlocked: boolean
): string[] {
  const finalAction = response.final_action;
  const t = actualLatencyMs / 1000;
  const slidingDist = oldState.velocity * t * 100; // cm
  const { newHp, newBattery, newTemp } = derived;

  const logs: string[] = [];
  const actionDesc = moveAction
    ? `MOVE (${moveAction.speed || DEFAULT_ACTION_SPEED}cm/s)`
    : finalAction[0]?.action?.toUpperCase() || "HALT";
  logs.push(`[DECISION] C2D Action: ${actionDesc} | Latency: ${actualLatencyMs}ms`);

  let physicsOutcome = "";
  if (isCollided) {
    physicsOutcome = `💥 [COLLISION] Impact! Gap was ${oldState.distance.toFixed(0)}cm, slid ${slidingDist.toFixed(0)}cm. HP reduced to ${newHp}.`;
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
    `[PHYSICS] V: ${oldState.velocity.toFixed(2)}m/s | Sliding: ${slidingDist.toFixed(1)}cm | Gap: ${oldState.distance.toFixed(0)}cm | Temp: ${newTemp}°C | ${physicsOutcome}`
  );

  if (newTemp > TEMP_OVERHEAT_THRESHOLD) {
    logs.push(`[WARNING] Core Temp ${newTemp}°C is high! Thermal throttle active (Extra battery drain).`);
  }

  return logs;
}

/**
 * Run one physics step from an old fleet snapshot + simulation response.
 * Pure: returns the new state + logs; the caller applies them.
 */
export function applyPhysicsStep(
  state: FleetState,
  response: SimulateResponse,
  jitterEnabled: boolean
): PhysicsStepResult {
  const finalAction = response.final_action;
  const actualLatencyMs = computeActualLatencyMs(response.latency_ms, jitterEnabled);
  const isBlocked = response.pipeline_trace.some((step) => step.status === "BLOCKED");

  const t = actualLatencyMs / 1000;
  const slidingDist = state.velocity * t * 100; // cm
  const moveAction = findMoveAction(finalAction);

  let newHp = state.hp;
  let newBattery = state.battery;
  let newTemp = state.temperature;
  let newVelocity = state.velocity;
  let newDistance = state.distance;
  let newCurrentX = state.currentX;
  let isCollided = false;

  // 1. Collision check & position/speed update
  if (slidingDist > state.distance && state.distance > 0) {
    newHp = Math.max(0, newHp - HP_COLLISION_DAMAGE);
    isCollided = true;
    // Vehicle travels the remaining distance, hits the wall, and stops.
    newCurrentX = Number((newCurrentX + state.distance / 100).toFixed(2));
    newDistance = 0;
    newVelocity = 0;
  } else {
    // Safe slide during the latency period.
    newCurrentX = Number((newCurrentX + slidingDist / 100).toFixed(2));
    newDistance = Math.max(0, Number((newDistance - slidingDist).toFixed(1)));
    newVelocity = moveAction ? (moveAction.speed || DEFAULT_ACTION_SPEED) / 100 : 0;
  }

  // 2. Temperature transition (may flag thermal throttle)
  const { newTemp: updatedTemp, thermalThrottleDrain } = calculateTemperatureChange(
    state,
    finalAction,
    moveAction
  );
  newTemp = updatedTemp;

  // 3. Battery drain
  const batteryDrain = calculateBatteryDrain(finalAction, thermalThrottleDrain);
  newBattery = Math.max(0, newBattery - batteryDrain);

  // 4. Logs
  const logs = buildPhysicsLogs(
    state,
    { newHp, newBattery, newTemp },
    response,
    actualLatencyMs,
    moveAction,
    isCollided,
    isBlocked
  );

  const shouldContinue = !(
    newHp <= 0 ||
    newBattery < LOW_BATTERY_THRESHOLD ||
    isBlocked ||
    isCollided ||
    !moveAction
  );

  return {
    state: {
      hp: newHp,
      battery: newBattery,
      // On stop the original forces velocity to 0; caller applies this directly.
      velocity: shouldContinue ? newVelocity : 0,
      temperature: newTemp,
      distance: newDistance,
      currentX: newCurrentX,
    },
    isCollided,
    isBlocked,
    logs,
    shouldContinue,
  };
}
