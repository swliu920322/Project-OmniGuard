import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildIndex,
  writeIndex,
  scanMarkdownFiles,
  extractHeadings,
  slugify,
} from './index.js';

const VALID_FM = [
  '---',
  'id: DOC-ADR-025',
  'title: "Kinematic Token Theorem Sandbox"',
  'summary: "Formalization of the Kinematic-Token safety deadlock and edge fallback architecture."',
  'version: "2.0.0"',
  'updated_at: "2026-08-15"',
  'authors: ["Shengwei Liu"]',
  'domains:',
  '  - cyber-physical-safety',
  '  - edge-inference',
  'perspectives:',
  '  - academic-research',
  '  - frontend-engineering',
  'layers:',
  '  - edge-client',
  'doc_type: adr',
  'status: accepted',
  'code_refs:',
  '  - src/example.ts',
  '---',
  '',
].join('\n');

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnidocs-'));
  fs.mkdirSync(path.join(dir, 'docs', 'adrs'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'example.ts'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(dir, 'docs', 'adrs', 'ADR-025-two.md'), VALID_FM + '# Heading One\n\nSome content here.\n\n## Heading Two\n\nMore content.\n');
  fs.writeFileSync(path.join(dir, 'docs', 'index.md'), 'no frontmatter here\n');
  return dir;
}

test('slugify produces a GitHub-style anchor', () => {
  assert.equal(slugify('Multi-Dimensional & Filter (v2)'), 'multi-dimensional-filter-v2');
});

test('extractHeadings returns ATX headings with depth and slug', () => {
  const headings = extractHeadings('# One\n\n## Two part\n\n### Three\n');
  assert.deepEqual(headings.map((h) => h.depth), [1, 2, 3]);
  assert.equal(headings[1].slug, 'two-part');
});

test('scanMarkdownFiles collects only .md/.mdx under root', () => {
  const dir = makeRepo();
  const files = scanMarkdownFiles(path.join(dir, 'docs'));
  assert.equal(files.length, 2);
  assert.ok(files.some((f) => f.endsWith('index.md')));
});

test('buildIndex fails on missing frontmatter by default', () => {
  const dir = makeRepo();
  assert.throws(() =>
    buildIndex({ docsRoot: path.join(dir, 'docs'), repoRoot: dir }),
  );
});

test('buildIndex skips undocumented files with allowMissingFrontmatter', () => {
  const dir = makeRepo();
  const result = buildIndex({
    docsRoot: path.join(dir, 'docs'),
    repoRoot: dir,
    allowMissingFrontmatter: true,
  });
  assert.equal(result.manifest.docCount, 1);
  assert.equal(result.manifest.docs[0].id, 'DOC-ADR-025');
  assert.equal(result.manifest.docs[0].headings.length, 2);
  assert.equal(result.manifest.docs[0].readingTimeMinutes, 1);
});

test('buildIndex reports dead code refs', () => {
  const dir = makeRepo();
  const csv = fs.readFileSync(path.join(dir, 'docs', 'adrs', 'ADR-025-two.md'), 'utf-8');
  fs.writeFileSync(
    path.join(dir, 'docs', 'adrs', 'ADR-025-two.md'),
    csv.replace('src/example.ts', 'src/missing.ts'),
  );
  const result = buildIndex({ docsRoot: path.join(dir, 'docs'), repoRoot: dir, allowMissingFrontmatter: true });
  assert.ok(result.warnings.some((w) => w.includes('src/missing.ts')));
});

test('buildIndex emits code_ref and same_domain edges', () => {
  const dir = makeRepo();
  const result = buildIndex({ docsRoot: path.join(dir, 'docs'), repoRoot: dir, allowMissingFrontmatter: true });
  const refEdge = result.graph.edges.find((e) => e.type === 'code_ref');
  assert.ok(refEdge);
  assert.equal(refEdge!.target, 'src/example.ts');
});

test('writeIndex persists manifest + relation graph', () => {
  const dir = makeRepo();
  const result = buildIndex({ docsRoot: path.join(dir, 'docs'), repoRoot: dir, allowMissingFrontmatter: true });
  const outDir = path.join(dir, 'generated', 'docs');
  const written = writeIndex(outDir, result);
  assert.ok(written.some((p) => p.endsWith('docs-manifest.json')));
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'docs-manifest.json'), 'utf-8'));
  assert.equal(manifest.contractVersion, '1.0.0');
  assert.equal(manifest.docCount, 1);
});