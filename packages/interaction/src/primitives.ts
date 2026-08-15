import { easings, type TrackSpec } from './timeline.js';

/**
 * Interaction Primitives — ready-made gesture tracks for the declarative
 * timeline engine. Each is a *contract* (typed TrackSpec) that render layers
 * consume. They encode the "unified motion language" idea: consistent easing,
 * consistent input window, consistent output domain.
 */

/** Reveal on scroll: translate + opacity, direction by intensity sign. */
export function reveal(opts: {
  id?: string;
  /** -1..1; negative slides from left, positive from right. */
  intensity?: number;
  from?: number;
  to?: number;
}): TrackSpec {
  return {
    id: opts.id ?? 'reveal',
    intensity: opts.intensity ?? 1,
    from: opts.from ?? 0,
    to: opts.to ?? 0.4,
    points: [
      [0, 0],
      [1, 1],
    ],
    ease: easings.easeOut,
    clamp: [0, 1],
  };
}

/** Parallax: content moves slower than scroll (0.2 = 20% speed). */
export function parallax(opts: {
  id?: string;
  intensity?: number;
  from?: number;
  to?: number;
}): TrackSpec {
  return {
    id: opts.id ?? 'parallax',
    intensity: opts.intensity ?? 0.2,
    from: opts.from ?? 0,
    to: opts.to ?? 1,
    points: [
      [0, 0],
      [1, 1],
    ],
    ease: easings.linear,
  };
}

/** Magnetic hover: number drifts toward pointer proximity (input from CSS var-based strength). */
export function magnetic(opts: { id?: string; strength?: number }): TrackSpec {
  return {
    id: opts.id ?? 'magnetic',
    intensity: opts.strength ?? 1,
    from: 0,
    to: 1,
    points: [
      [0, 0],
      [0.5, 0.7],
      [1, 1],
    ],
    ease: easings.easeOut,
    clamp: [-1.2, 1.2],
  };
}

/** Rolling counter: number counts to target as section scrolls in. */
export function springNumber(opts: { id?: string; from?: number; to?: number; target?: number }): TrackSpec {
  const target = opts.target ?? 100;
  return {
    id: opts.id ?? 'springNumber',
    intensity: 1,
    from: opts.from ?? 0,
    to: opts.to ?? 0.5,
    points: [
      [0, 0],
      [1, target],
    ],
    ease: easings.easeInOut,
    clamp: [0, target],
  };
}

/** Marquee drift: continuous x from -30% to 30% (looped by consumers). */
export function marquee(opts: { id?: string; intensity?: number }): TrackSpec {
  return {
    id: opts.id ?? 'marquee',
    intensity: opts.intensity ?? 0.3,
    from: 0,
    to: 1,
    points: [
      [0, -0.3],
      [1, 0.3],
    ],
    ease: easings.linear,
  };
}

/** 3D tilt: pitch driven by pointer x/y mapped to [-1,1]. */
export function tilt(opts: { id?: string; maxDeg?: number }): TrackSpec {
  const max = opts.maxDeg ?? 12;
  return {
    id: opts.id ?? 'tilt',
    intensity: 1,
    from: 0,
    to: 1,
    points: [
      [0, -max],
      [1, max],
    ],
    ease: easings.easeOut,
    clamp: [-max, max],
  };
}

/** Scroll progress indicator: 0..1 across an element. */
export function scrollProgress(opts: { id?: string }): TrackSpec {
  return {
    id: opts.id ?? 'scrollProgress',
    intensity: 1,
    from: 0,
    to: 1,
    points: [
      [0, 0],
      [1, 1],
    ],
    ease: easings.linear,
    clamp: [0, 1],
  };
}