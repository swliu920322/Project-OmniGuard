import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCS_CONTRACT_VERSION,
  DocMetadataSchema,
  DocManifestSchema,
  RelationGraphSchema,
  assertContractCompatible,
  PerspectiveSchema,
  DomainSchema,
  isBuiltInPerspective,
  isBuiltInDomain,
} from './index.js';

const validMeta = {
  id: 'DOC-ADR-025',
  title: 'Kinematic Token Theorem Sandbox',
  summary: 'Formalization of the Kinematic-Token safety deadlock and edge fallback architecture.',
  version: '2.0.0',
  updated_at: '2026-08-15',
  authors: ['Shengwei Liu'],
  domains: ['cyber-physical-safety', 'edge-inference'],
  perspectives: ['academic-research', 'frontend-engineering'],
  layers: ['edge-client'],
  doc_type: 'adr',
  status: 'accepted',
  code_refs: ['src/client-edge/src/index.ts'],
  test_refs: [],
};

test('DOCS_CONTRACT_VERSION follows semver', () => {
  assert.match(DOCS_CONTRACT_VERSION, /^\d+\.\d+\.\d+$/);
});

test('valid metadata passes DocMetadataSchema', () => {
  const parsed = DocMetadataSchema.parse(validMeta);
  assert.equal(parsed.code_refs.length, 1);
  assert.equal(parsed.version, '2.0.0');
});

test('metadata rejects an invalid ID format', () => {
  assert.throws(() => DocMetadataSchema.parse({ ...validMeta, id: 'not-a-doc-id' }));
});

test('metadata accepts user-defined (open) perspective', () => {
  const parsed = DocMetadataSchema.parse({
    ...validMeta,
    perspectives: ['academic-research', 'retail-margin-analytics'],
  });
  assert.ok(parsed.perspectives.includes('retail-margin-analytics'));
  assert.equal(isBuiltInPerspective('academic-research'), true);
  assert.equal(isBuiltInPerspective('retail-margin-analytics'), false);
});

test('metadata accepts user-defined (open) domain', () => {
  const parsed = DocMetadataSchema.parse({
    ...validMeta,
    domains: ['edge-inference', 'payment-processing'],
  });
  assert.ok(parsed.domains.includes('payment-processing'));
  assert.equal(isBuiltInDomain('edge-inference'), true);
  assert.equal(isBuiltInDomain('payment-processing'), false);
});

test('open taxonomy tag must be kebab-case identifier', () => {
  assert.throws(() => PerspectiveSchema.parse('Bad Tag With Spaces'));
  assert.throws(() => DomainSchema.parse('UPPER_CASE'));
  assert.equal(DomainSchema.parse('my-custom-domain-2'), 'my-custom-domain-2');
});

test('metadata rejects empty domains', () => {
  assert.throws(() => DocMetadataSchema.parse({ ...validMeta, domains: [] }));
});

test('optional fields default correctly', () => {
  const { authors, status, code_refs } = DocMetadataSchema.parse(validMeta);
  assert.deepEqual(authors, ['Shengwei Liu']);
  assert.equal(status, 'accepted');
  assert.deepEqual(code_refs, ['src/client-edge/src/index.ts']);
});

test('manifest schema validates a full doc bundle', () => {
  const key = { ...validMeta, filePath: 'docs/adrs/ADR-025.md', headings: [], wordCount: 100, readingTimeMinutes: 1 };
  const manifest = {
    contractVersion: DOCS_CONTRACT_VERSION,
    generatedAt: '2026-08-15T00:00:00.000Z',
    docCount: 1,
    docs: [{ ...key, slug: 'adrs/ADR-025' }],
  };
  const parsed = DocManifestSchema.parse(manifest);
  assert.equal(parsed.docCount, 1);
});

test('relation graph schema validates edges', () => {
  const key = { ...validMeta, filePath: 'docs/adrs/ADR-025.md', headings: [], wordCount: 100, readingTimeMinutes: 1 };
  const graph = {
    contractVersion: DOCS_CONTRACT_VERSION,
    generatedAt: '2026-08-15T00:00:00.000Z',
    nodes: [{ ...key, slug: 'adrs/ADR-025' }],
    edges: [{ source: 'DOC-ADR-025', target: 'src/client-edge/src/index.ts', type: 'code_ref' }],
  };
  const parsed = RelationGraphSchema.parse(graph);
  assert.equal(parsed.edges[0].type, 'code_ref');
});

test('relation graph rejects unknown relation type', () => {
  const graph = { contractVersion: DOCS_CONTRACT_VERSION, generatedAt: 'x', nodes: [], edges: [{ source: 'a', target: 'b', type: 'wat' }] };
  assert.throws(() => RelationGraphSchema.parse(graph));
});

test('assertContractCompatible accepts same major, rejects different major', () => {
  assert.doesNotThrow(() => assertContractCompatible('1.2.0', '1.0.0'));
  assert.throws(() => assertContractCompatible('2.0.0', '1.0.0'));
});