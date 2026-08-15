/**
 * OmniDocs Interaction Core — Declarative Timeline Engine.
 *
 * Philosophy (see docs/plan/ai-era-software-philosophy-and-prototype.md §3.3):
 *   Timeline gestures = contract (typed, validated)
 *   Data + preference vector = content (injected, controlled)
 *   Engine = interpreter (renders the dynamic form)
 *
 * This core is FRAMEWORK-AGNOSTIC: it has zero React/DOM dependencies so it can
 * be unit-tested headlessly and driven by any render layer (React, web component,
 * canvas). Clamp-based easing and scroll mapping keep it dependency-free.
 */

export type Easing = (t: number) => number;

/** Standard easing curves. */
export const easings = {
  linear: ((t) => t) as Easing,
  easeInOut: ((t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)) as Easing,
  easeOut: ((t) => 1 - Math.pow(1 - t, 3)) as Easing,
  easeIn: ((t) => t * t * t) as Easing,
  elastic: ((t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }) as Easing,
} as const;

/**
 * A Track maps an input progress + intensity into an interpolated value.
 * Control points are normalized to [-1..1] by convention, making a track
 * analogous to a labelled dimension of a preference/gesture vector.
 */
export interface TrackSpec<T = number> {
  id: string;
  /** 0.5 = neutral, 0 = low, 1 = high. Drives direction & magnitude of the effect. */
  intensity?: number;
  /** Input window, default [0,1] of the source. */
  from?: number;
  to?: number;
  /** Output control points: [at, value] pairs in [0,1] x [valueDomain]. */
  points: Array<[number, number]>;
  ease?: Easing;
  /** Optional clamp of final value. */
  clamp?: [number, number];
}

export type MotionValue = {
  id: string;
  value: number;
  /** Raw progress 0..1 before easing & clamping. */
  progress: number;
};

export type DriverInput = {
  /** Normalized source progress, e.g. scroll position within a section: 0..1. */
  progress: number;
  /** Ad hoc modifiers (preference vector, content type, etc.). */
  strength?: number;
};

/** Piecewise-linear interpolation over control points. */
function interpolate(points: Array<[number, number]>, x: number): number {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [xa, ya] = pts[i];
    const [xb, yb] = pts[i + 1];
    if (x >= xa && x <= xb) {
      const t = (x - xa) / (xb - xa);
      return ya + t * (yb - ya);
    }
  }
  return last[1];
}

/**
 * Evaluate a track at a point in time/space.
 * `strength` scales the responsibility of the gesture — this is where the
 * preference vector and content data enter the form (data-driven motion).
 */
export function evaluateTrack(track: TrackSpec, driver: DriverInput): MotionValue {
  const from = track.from ?? 0;
  const to = track.to ?? 1;
  const span = to - from || 1;
  const raw = Math.min(1, Math.max(0, (driver.progress - from) / span));
  const eased = (track.ease ?? easings.easeInOut)(raw);
  const intensity = track.intensity ?? 1;
  const strength = driver.strength ?? 1;
  let value = interpolate(track.points, eased) * intensity * strength;
  if (track.clamp) value = Math.min(track.clamp[1], Math.max(track.clamp[0], value));
  return { id: track.id, value, progress: raw };
}

/** A Timeline is a named, versioned set of tracks — the gesture contract. */
export interface Timeline {
  name: string;
  version: string;
  tracks: TrackSpec[];
}

/** Evaluate every track of a timeline for a given driver. Returns MotionValues keyed by id. */
export function runTimeline(timeline: Timeline, driver: DriverInput): Record<string, MotionValue> {
  const out: Record<string, MotionValue> = {};
  for (const track of timeline.tracks) {
    out[track.id] = evaluateTrack(track, driver);
  }
  return out;
}

/** Combine two timelines (e.g. stable preference layer + situational layer). */
export function composeTimelines(base: MotionValue[], overlay: MotionValue[]): Record<string, MotionValue> {
  const out: Record<string, MotionValue> = {};
  for (const b of base) out[b.id] = b;
  for (const o of overlay) {
    out[o.id] = { ...o, value: (out[o.id]?.value ?? 0) + o.value };
  }
  return out;
}