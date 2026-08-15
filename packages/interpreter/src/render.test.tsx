import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fromAdr, fromBlueprint, type AdrContent, type BlueprintContent } from './lexer.js';
import { FORM_PRESETS, getPreset } from './form-spec.js';
import { Interpret } from './render.js';

const adr: AdrContent = {
  id: 'DOC-ADR-025',
  docType: 'adr',
  status: 'accepted',
  title: { zh: 'Kinematic Token 定理沙盒', en: 'Kinematic Token Theorem Sandbox' },
  abstract: { zh: '抽象。', en: 'The abstract.' },
  formula: 'V_max ≤ D / (L + T/S)',
  formulaLabel: { zh: '最大安全速度', en: 'Max safe speed' },
  context: { zh: '具身 AI 盲行。', en: 'Embodied AI moves blind.' },
  drivers: [{ zh: '零后端。', en: 'Zero backend.' }],
  decision: { zh: '构建议。', en: 'Build a sandbox.' },
  consequences: [{ zh: '离线可用。', en: 'Fully offline.' }],
};

test('lexer maps ADR fields onto generic blocks without loss', () => {
  const doc = fromAdr(adr);
  assert.equal(doc.id, 'DOC-ADR-025');
  assert.ok(doc.abstract);
  assert.equal(doc.blocks.filter((b) => b.type === 'formula').length, 1);
  assert.equal(doc.blocks.filter((b) => b.type === 'callout').length, 2);
  assert.equal(doc.blocks.filter((b) => b.type === 'list').length, 1);
  assert.equal(doc.blocks.filter((b) => b.type === 'paragraph').length, 1);
});

test('FormSpec presets differ on structural axes (not just color)', () => {
  const a = FORM_PRESETS.academic;
  const p = FORM_PRESETS.playbook;
  const n = FORM_PRESETS.narrative;
  assert.notEqual(a.structure.header, p.structure.header);
  assert.notEqual(p.structure.header, n.structure.header);
  assert.notEqual(a.density.lang, p.density.lang);
  assert.notEqual(p.density.lang, n.density.lang);
  assert.notEqual(a.structure.formula, p.structure.formula);
  // 结构与密度同时不同 → "换骨" saticfy
  const structuralPairs = [a.structure, p.structure, n.structure];
  const uniqueStructures = new Set(structuralPairs.map((s) => JSON.stringify(s)));
  assert.equal(uniqueStructures.size, 3, 'three presets must have three distinct structures');
  const uniqueDensities = new Set([a.density, p.density, n.density].map((d) => JSON.stringify(d)));
  assert.equal(uniqueDensities.size, 3, 'three presets must have three distinct densities');
});

test('unknown preset falls back to academic', () => {
  assert.equal(getPreset('not-a-form').key, 'academic');
});

test('render is a pure function of (content, spec)', () => {
  const doc = fromAdr(adr);
  const html = renderToStaticMarkup(
    React.createElement(Interpret, { doc, spec: FORM_PRESETS.academic }),
  );
  assert.ok(html.includes('DOC-ADR-025'));
  assert.ok(html.includes('The abstract.'));
  assert.ok(html.includes('V_max'));
});

test('language policy curates which language surfaces (non-mutating)', () => {
  const doc = fromAdr(adr);
  const en = renderToStaticMarkup(
    React.createElement(Interpret, { doc, spec: FORM_PRESETS.playbook }),
  );
  const zh = renderToStaticMarkup(
    React.createElement(Interpret, { doc, spec: FORM_PRESETS.narrative }),
  );
  // playbook is en-only: Chinese abstract must NOT appear
  assert.ok(en.includes('Zero backend.'));
  assert.ok(!en.includes('零后端'));
  // narrative is zh-only: English must NOT appear
  assert.ok(zh.includes('具身 AI 盲行。'));
  assert.ok(!zh.includes('Embodied AI moves blind.'));
});

test('formula treatment differs across presets', () => {
  const doc = fromAdr(adr);
  const playbook = renderToStaticMarkup(
    React.createElement(Interpret, { doc, spec: FORM_PRESETS.playbook }),
  );
  const narrative = renderToStaticMarkup(
    React.createElement(Interpret, { doc, spec: FORM_PRESETS.narrative }),
  );
  const academic = renderToStaticMarkup(
    React.createElement(Interpret, { doc, spec: FORM_PRESETS.academic }),
  );
  // narrative uses a highlight card (rounded-2xl border)
  assert.ok(narrative.includes('rounded-2xl') || narrative.includes('border'));
  // academic & playbook differ structurally from narrative treatment
  assert.notEqual(playbook, narrative);
  assert.notEqual(academic, playbook);
});

/* ------------------------------------------------------------------ */
/* Blueprint lexer — proves engine generality: new doc type = new lexer */
/* ------------------------------------------------------------------ */

const bp: BlueprintContent = {
  id: 'DOC-BP-04',
  docType: 'blueprint',
  status: 'accepted',
  title: { zh: '可观测平台', en: 'Observability Platform' },
  abstract: { zh: '三层可观测蓝图。', en: 'A three-layer observability blueprint.' },
  context: { zh: '无告警、无追踪。', en: 'No alerts, no tracing today.' },
  gapMatrix: [
    {
      capability: { zh: '分布式追踪', en: 'Distributed tracing' },
      status: { zh: '无', en: 'Missing' },
      importance: { zh: '高', en: 'High' },
    },
    {
      capability: { zh: '告警规则', en: 'Alert rules' },
      status: { zh: '无', en: 'Missing' },
      importance: { zh: '高', en: 'High' },
    },
  ],
  steps: [
    { title: { zh: '链路追踪', en: 'Enable tracing' }, body: { zh: '集成 OpenTelemetry。', en: 'Wire in OpenTelemetry.' } },
    { title: { zh: '告警', en: 'Alerts' }, body: { zh: '定义 Action Groups。', en: 'Define action groups.' } },
  ],
  acceptance: [
    { zh: '查询延迟 < 5s', en: 'Query latency under 5s' },
    { zh: '告警可达', en: 'Alerts reachable' },
  ],
};

test('blueprint lexer maps sections onto generic blocks (incl. table)', () => {
  const doc = fromBlueprint(bp);
  assert.equal(doc.docType, 'blueprint');
  assert.equal(doc.blocks.filter((b) => b.type === 'table').length, 1);
  assert.equal(doc.blocks.filter((b) => b.type === 'callout').length, 1);
  assert.equal(doc.blocks.filter((b) => b.type === 'list').length, 2);
});

test('blueprint renders through the SAME engine with zero engine change', () => {
  const doc = fromBlueprint(bp);
  const html = renderToStaticMarkup(
    React.createElement(Interpret, { doc, spec: FORM_PRESETS.academic }),
  );
  assert.ok(html.includes('Observability Platform'));
  assert.ok(html.includes('Distributed tracing'));
  assert.ok(/<table/.test(html), 'table block must render');
});

test('blueprint interprets differently across forms (engine-driven)', () => {
  const doc = fromBlueprint(bp);
  const zh = renderToStaticMarkup(
    React.createElement(Interpret, { doc, spec: FORM_PRESETS.narrative }),
  );
  const en = renderToStaticMarkup(
    React.createElement(Interpret, { doc, spec: FORM_PRESETS.playbook }),
  );
  assert.ok(zh.includes('可观测平台'));
  assert.ok(en.includes('Observability Platform'));
  assert.ok(!zh.includes('Observability Platform'));
});

test('decimal list markers increment per item, not per block', () => {
  const doc = fromBlueprint(bp);
  const html = renderToStaticMarkup(
    React.createElement(Interpret, { doc, spec: FORM_PRESETS.academic }),
  );
  // marker 渲染为 <span class="...">N.</span>；精确匹配避免误伤正文里的数字。
  const markers = [...html.matchAll(/>(\d+)\.<\/span>/g)].map((m) => m[1]);
  // fixture 有 steps(2 项) + acceptance(2 项)：应得到 1,2,1,2 —— 每个列表按条目递增。
  assert.deepEqual(markers, ['1', '2', '1', '2']);
});