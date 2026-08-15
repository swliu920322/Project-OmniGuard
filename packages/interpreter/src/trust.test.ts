import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFormSpec, describeSpec } from './sanitize.js';
import { interpretIntent, resolveIntentIntent } from './intent.js';
import { FORM_PRESETS } from './form-spec.js';

test('sanitize: preset shortcut returns the built-in preset', () => {
  assert.equal(sanitizeFormSpec({ preset: 'playbook' }).key, 'playbook');
  assert.equal(sanitizeFormSpec({ preset: 'narrative' }).key, 'narrative');
  assert.equal(sanitizeFormSpec({ preset: 'not-a-preset' }).key, 'academic');
});

test('sanitize: garbage in falls back to safe academic spec (never crashes)', () => {
  const inputs = [
    null,
    'just a string',
    42,
    {},
    { surface: { tone: 'neon-pink' } },
    { density: { lang: 'klingon' } },
    { structure: { width: 'infinite', header: 'magic' } },
  ];
  for (const input of inputs) {
    const spec = sanitizeFormSpec(input);
    assert.ok(spec.surface.tone, 'tone must be set');
    assert.ok(['paper', 'terminal', 'warm'].includes(spec.surface.tone));
    assert.ok(['serif', 'sans', 'mono'].includes(spec.typography.family));
    assert.ok(['academic', 'playbook', 'narrative'].some((k) => spec.key === k || spec.key === 'model'));
    assert.notEqual(input, spec, 'never cryptographically equal garbage');
  }
});

test('sanitize: model fragment is honored, unknown keys discarded', () => {
  const spec = sanitizeFormSpec({
    density: { lang: 'zh' },
    surface: { tone: 'warm' },
    evil: { any: 'thing' },
    structure: { formula: 'highlight-card' },
    "__proto__": { injected: true },
  });
  assert.equal(spec.density.lang, 'zh');
  assert.equal(spec.surface.tone, 'warm');
  assert.equal(spec.structure.formula, 'highlight-card');
  assert.equal((spec as any).evil, undefined);
  assert.equal((spec as any).__proto__.injected, undefined);
});

test('sanitize: partial fragment inherits academic defaults', () => {
  const spec = sanitizeFormSpec({ density: { collapseSections: true } });
  assert.equal(spec.density.collapseSections, true);
  assert.equal(spec.surface.tone, FORM_PRESETS.academic.surface.tone);
  assert.equal(spec.motion.reveal, FORM_PRESETS.academic.motion.reveal);
});

test('describe: renders a human-readable reading of the spec', () => {
  const d = describeSpec(sanitizeFormSpec({ preset: 'playbook' }));
  assert.ok(d.includes('英文'));
  const zh = describeSpec(sanitizeFormSpec({ preset: 'narrative' }));
  assert.ok(zh.includes('中文'));
  assert.ok(zh.includes('暖色'));
});

test('interpretIntent: routes by keyword to the matching preset', () => {
  assert.equal(interpretIntent('给运维做一份英文操作手册').preset, 'playbook');
  assert.equal(interpretIntent('给老板写一份中文汇报').preset, 'narrative');
  assert.equal(interpretIntent('给评审看论文').preset, 'academic');
});

test('interpretIntent: no-confidence falls back to academic (safe neutral)', () => {
  const r = interpretIntent('今天天气不错');
  assert.equal(r.preset, 'academic');
  assert.equal(r.spec.key, 'academic');
});

test('resolveIntentIntent: raw override is sanitized before use', () => {
  const r = resolveIntentIntent('随便', { density: { lang: 'en' }, foo: 'bar' });
  assert.equal(r.spec.density.lang, 'en');
  assert.equal((r.spec as any).foo, undefined);
});