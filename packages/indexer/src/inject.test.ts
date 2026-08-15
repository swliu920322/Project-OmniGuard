import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { injectFrontmatter } from './inject.js';

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnidocs-inject-'));
  for (const sub of ['adrs', 'audits', 'tutorials', 'unknown-folder']) {
    fs.mkdirSync(path.join(dir, 'docs', sub), { recursive: true });
  }
  fs.writeFileSync(
    path.join(dir, 'docs', 'adrs', 'ADR-009-[architecture]-Shared-Physics-Kernel.md'),
    '# Shared Physics Kernel\n\nBody here.\n',
  );
  fs.writeFileSync(path.join(dir, 'docs', 'audits', 'deepseek-audit-report.md'), '# Audit\n\nBody.\n');
  fs.writeFileSync(path.join(dir, 'docs', 'tutorials', 'quickstart.md'), '# Quickstart\n\nBody.\n');
  fs.writeFileSync(path.join(dir, 'docs', 'unknown-folder', 'mystery.md'), '# Mystery\n\nBody.\n');
  return dir;
}

test('injectFrontmatter injects ADR with derived DOC id and accepted status', () => {
  const dir = makeRepo();
  const { injected } = injectFrontmatter({ docsRoot: path.join(dir, 'docs') });
  const adr = injected.find((i) => i.id === 'DOC-ADR-009');
  assert.ok(adr, 'expected DOC-ADR-009 injection');
  const raw = fs.readFileSync(path.join(dir, 'docs', 'adrs', 'ADR-009-[architecture]-Shared-Physics-Kernel.md'), 'utf-8');
  const { data } = matter(raw);
  assert.equal(data.id, 'DOC-ADR-009');
  assert.equal(data.status, 'accepted');
  assert.deepEqual(data.perspectives, ['cloud-architecture', 'frontend-engineering']);
});

test('injectFrontmatter maps audits and tutorials dirs to directory rules', () => {
  const dir = makeRepo();
  injectFrontmatter({ docsRoot: path.join(dir, 'docs') });
  const audit = matter(fs.readFileSync(path.join(dir, 'docs', 'audits', 'deepseek-audit-report.md'), 'utf-8')).data;
  const tutorial = matter(fs.readFileSync(path.join(dir, 'docs', 'tutorials', 'quickstart.md'), 'utf-8')).data;
  assert.equal(audit.doc_type, 'specification');
  assert.ok(audit.perspectives.includes('enterprise-audit'));
  assert.equal(tutorial.doc_type, 'tutorial');
});

test('injectFrontmatter is idempotent — second run injects nothing', () => {
  const dir = makeRepo();
  const first = injectFrontmatter({ docsRoot: path.join(dir, 'docs') });
  const second = injectFrontmatter({ docsRoot: path.join(dir, 'docs') });
  assert.ok(first.injected.length >= 3);
  assert.equal(second.injected.length, 0);
});

test('injectFrontmatter reports unsupported files without a rule', () => {
  const dir = makeRepo();
  const { unsupported } = injectFrontmatter({
    docsRoot: path.join(dir, 'docs'),
    targets: ['adrs', 'audits', 'tutorials', 'unknown-folder'],
  });
  assert.ok(unsupported.some((u) => u.includes('unknown-folder/mystery.md')));
});

test('inject output parses back through gray-matter as valid YAML', () => {
  const dir = makeRepo();
  injectFrontmatter({ docsRoot: path.join(dir, 'docs') });
  for (const file of fs.readdirSync(path.join(dir, 'docs', 'adrs'))) {
    const { data } = matter(fs.readFileSync(path.join(dir, 'docs', 'adrs', file), 'utf-8'));
    assert.ok(data.id && data.title && data.summary);
  }
});