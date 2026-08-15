import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  easings,
  evaluateTrack,
  runTimeline,
  composeTimelines,
  reveal,
  parallax,
  springNumber,
  tilt,
} from './index.js';

const testableTla = { ...easings, easeInOut: ((t: number) => t) as (t: number) => number };

test('evaluateTrack interpolates control points linearly at raw progress', () => {
  const track = evaluateTrack(
    {
      id: 'x',
      points: [
        [0, 0],
        [1, 100],
      ],
      ease: testableTla.easeInOut,
    },
    { progress: 0.5 },
  );
  assert.equal(track.value, 50);
});

test('evaluateTrack clamps progress outside [from,to] window', () => {
  const track = evaluateTrack(
    {
      id: 'x',
      from: 0.2,
      to: 0.8,
      points: [
        [0, 0],
        [1, 10],
      ],
      ease: testableTla.easeInOut,
    },
    { progress: 0 },
  );
  assert.equal(track.value, 0);
});

test('intensity scales the output magnitude', () => {
  const low = evaluateTrack({ id: 'x', intensity: 0.5, points: [[0, 0], [1, 10]], ease: testableTla.easeInOut }, { progress: 1 });
  const high = evaluateTrack({ id: 'x', intensity: 2, points: [[0, 0], [1, 10]], ease: testableTla.easeInOut }, { progress: 1 });
  assert.equal(low.value, 5);
  assert.equal(high.value, 20);
});

test('clamp window constrains final value', () => {
  const track = evaluateTrack(
    { id: 'x', intensity: 5, clamp: [-1, 1], points: [[0, 0], [1, 10]], ease: testableTla.easeInOut },
    { progress: 1 },
  );
  assert.equal(track.value, 1);
});

test('reveal primitive produces a 0->1 contract', () => {
  const track = reveal({ intensity: 1 });
  const mid = evaluateTrack(track, { progress: 0.2 });
  assert.ok(mid.value > 0 && mid.value <= 1);
  const done = evaluateTrack(track, { progress: 1 });
  assert.equal(done.value, 1);
});

test('parallax primitive scales with strength input (data-driven motion)', () => {
  const weak = evaluateTrack(parallax({ intensity: 0.2 }), { progress: 1, strength: 1 });
  const strong = evaluateTrack(parallax({ intensity: 0.2 }), { progress: 1, strength: 4 });
  assert.equal(weak.value, 0.2);
  assert.equal(strong.value, 0.8);
});

test('springNumber rolls toward target', () => {
  const track = springNumber({ target: 100 });
  const half = evaluateTrack(track, { progress: 0.25 });
  const done = evaluateTrack(track, { progress: 1 });
  assert.ok(half.value > 0 && half.value < 100);
  assert.equal(done.value, 100);
});

test('tilt primitive clamps to max degrees', () => {
  const track = tilt({ maxDeg: 12 });
  const full = evaluateTrack(track, { progress: 1 });
  assert.equal(full.value, 12);
});

test('runTimeline evaluates all tracks keyed by id', () => {
  const tl = { name: 'hero', version: '1.0.0', tracks: [reveal({ id: 'r' }), parallax({ id: 'p', intensity: 0.3 })] };
  const out = runTimeline(tl, { progress: 1 });
  assert.ok(out.r && out.p);
  assert.equal(out.r.value, 1);
  assert.equal(out.p.value, 0.3);
});

test('composeTimelines overlays situational layer onto stable layer', () => {
  const stable = runTimeline({ name: 's', version: '1', tracks: [{ id: 'density', points: [[0, 0.3], [1, 0.3]], ease: testableTla.easeInOut }] }, { progress: 1 });
  const situational = runTimeline({ name: 'o', version: '1', tracks: [{ id: 'density', points: [[0, -0.2], [1, -0.2]], ease: testableTla.easeInOut }] }, { progress: 1 });
  const merged = composeTimelines(Object.values(stable), Object.values(situational));
  assert.ok(Math.abs(merged.density.value - 0.1) < 1e-9);
});