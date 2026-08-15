import { z } from 'zod';

/**
 * OmniDocs Data Contract — Source of Truth.
 *
 * THIS PACKAGE MUST REMAIN FRAMEWORK-AGNOSTIC.
 * It is imported by the indexer (build-time CLI), the ui/elements
 * components (runtime consumers) and any third-party host that wishes
 * to consume the docs manifest. Keep it dependency-free except `zod`.
 */

/**
 * Contract Package Version (CPV).
 * Bump the MAJOR value on any breaking change to the manifest shape or
 * a field-type/enum mutation. Consumers SHOULD assert at runtime that the
 * contractVersion in a manifest is compatible with this constant.
 */
export const DOCS_CONTRACT_VERSION = '1.0.0';

/**
 * Built-in taxonomy — recommended defaults shipped with the contract.
 *
 * These are NOT an exhaustive closed set: a host may define their own
 * perspectives/domains (e.g. an external user whose docs have nothing to
 * do with cyber-physical safety). Built-ins act as a curated starting point
 * and as the axis along which the shipped content is already tagged.
 * Validate with the OPEN schemas below; the enum variants descend from these
 * lists and stay available for strict consumers that opt into them.
 */
export const BUILTIN_PERSPECTIVES = [
  'academic-research',
  'cloud-architecture',
  'frontend-engineering',
  'enterprise-audit',
] as const;
/** @deprecated Use `BUILTIN_PERSPECTIVES` — the taxonomy is now open. */
export const PERSPECTIVES = BUILTIN_PERSPECTIVES;
export type BuiltInPerspective = (typeof BUILTIN_PERSPECTIVES)[number];

export const BUILTIN_DOMAINS = [
  'cyber-physical-safety',
  'multi-agent',
  'zero-trust-network',
  'edge-inference',
  'iac-bicep',
  'finops',
  'observability',
  'iot-telemetry',
] as const;
/** @deprecated Use `BUILTIN_DOMAINS` — the taxonomy is now open. */
export const DOMAINS = BUILTIN_DOMAINS;
export type BuiltInDomain = (typeof BUILTIN_DOMAINS)[number];

/**
 * Open taxonomy tags — hosts may define arbitrary perspectives/domains.
 * Constrained to lowercase kebab/case-dashed identifiers so they stay safe
 * in URLs, CSS class names and manifest JSON keys.
 */
const TAG_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;

export const PerspectiveSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(TAG_PATTERN, 'Perspective must be a lowercase kebab-case identifier.')
  .describe('Perspective tag — built-in or host-defined.');
export type Perspective = z.infer<typeof PerspectiveSchema>;

export const DomainSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(TAG_PATTERN, 'Domain must be a lowercase kebab-case identifier.')
  .describe('Domain tag — built-in or host-defined.');
export type Domain = z.infer<typeof DomainSchema>;

export function isBuiltInPerspective(v: string): v is BuiltInPerspective {
  return (BUILTIN_PERSPECTIVES as readonly string[]).includes(v);
}

export function isBuiltInDomain(v: string): v is BuiltInDomain {
  return (BUILTIN_DOMAINS as readonly string[]).includes(v);
}

export const LAYERS = [
  'edge-client',
  'cloud-orchestrator',
  'iac-infra',
  'cross-cutting',
] as const;
export type Layer = (typeof LAYERS)[number];

export const DOC_TYPES = [
  'adr',
  'blueprint',
  'specification',
  'tutorial',
  'playbook',
  'theorem',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_STATUSES = [
  'draft',
  'in-review',
  'accepted',
  'superseded',
  'deprecated',
] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* Metadata schema — validated against every markdown frontmatter under docs/  */
/* ------------------------------------------------------------------ */

export const PerspectiveEnum = z.enum(BUILTIN_PERSPECTIVES);
export const DomainEnum = z.enum(BUILTIN_DOMAINS);
export const LayerEnum = z.enum(LAYERS);
export const DocTypeEnum = z.enum(DOC_TYPES);
export const DocStatusEnum = z.enum(DOC_STATUSES);

export const DocMetadataSchema = z.object({
  id: z
    .string()
    .regex(/^DOC-[A-Z0-9_-]+$/, 'Invalid ID format. Must match DOC-[CATEGORY]-[NUM]')
    .describe('Globally unique doc id, e.g. DOC-ADR-025'),
  title: z.string().min(3),
  summary: z.string().min(10),
  version: z.string().default('1.0.0'),
  updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  authors: z.array(z.string()).default(['OmniGuard Team']),
  domains: z.array(DomainSchema).min(1),
  perspectives: z.array(PerspectiveSchema).min(1),
  layers: z.array(LayerEnum).min(1),
  doc_type: DocTypeEnum,
  status: DocStatusEnum.default('accepted'),
  code_refs: z.array(z.string()).optional().default([]).describe('Relative file paths that MUST physically exist in the repo'),
  test_refs: z.array(z.string()).optional().default([]).describe('Relative test paths that MUST physically exist in the repo'),
});

export type DocMetadata = z.infer<typeof DocMetadataSchema>;

/* ------------------------------------------------------------------ */
/* Derived doc record — manifest entries built by the indexer          */
/* ------------------------------------------------------------------ */

export const HeadingSchema = z.object({
  depth: z.number().int().min(1).max(6),
  text: z.string(),
  slug: z.string(),
});
export type Heading = z.infer<typeof HeadingSchema>;

export const DocItemSchema = DocMetadataSchema.extend({
  slug: z.string().describe('URL path derived from the file path, e.g. adrs/ADR-025'),
  filePath: z.string().describe('Repository-relative file path, e.g. docs/adrs/ADR-025-*.md'),
  headings: z.array(HeadingSchema).default([]),
  wordCount: z.number().int().nonnegative(),
  readingTimeMinutes: z.number().int().positive(),
});
export type DocItem = z.infer<typeof DocItemSchema>;

/* ------------------------------------------------------------------ */
/* Relation graph — the knowledge-network contract                     */
/* ------------------------------------------------------------------ */

export const RELATION_TYPES = ['code_ref', 'test_ref', 'same_domain', 'perspective_cluster'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const RelationTypeEnum = z.enum(RELATION_TYPES);

export const RelationEdgeSchema = z.object({
  source: z.string().describe('source doc id'),
  target: z.string().describe('target doc id or file path'),
  type: RelationTypeEnum,
});
export type RelationEdge = z.infer<typeof RelationEdgeSchema>;

export const RelationGraphSchema = z.object({
  contractVersion: z.string(),
  generatedAt: z.string(),
  nodes: z.array(DocItemSchema),
  edges: z.array(RelationEdgeSchema),
});
export type RelationGraph = z.infer<typeof RelationGraphSchema>;

/* ------------------------------------------------------------------ */
/* Top-level manifest — the product contract emitted by the indexer    */
/* ------------------------------------------------------------------ */

export const DocManifestSchema = z.object({
  contractVersion: z.string(),
  generatedAt: z.string(),
  docCount: z.number().int().nonnegative(),
  docs: z.array(DocItemSchema),
});
export type DocManifest = z.infer<typeof DocManifestSchema>;

/** Assert that a manifest/graph was produced by a compatible contract version. */
export function assertContractCompatible(
  dataVersion: string,
  expected: string = DOCS_CONTRACT_VERSION,
): void {
  const [dMajor] = dataVersion.split('.').map(Number);
  const [eMajor] = expected.split('.').map(Number);
  if (dMajor !== eMajor) {
    throw new Error(
      `Contract version mismatch: manifest @ ${dataVersion}, consumer expects ${expected} (major must match).`,
    );
  }
}