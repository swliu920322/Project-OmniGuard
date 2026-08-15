import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {
  DOCS_CONTRACT_VERSION,
  DocMetadataSchema,
  type DocItem,
  type Heading,
  type RelationEdge,
  type DocManifest,
  type RelationGraph,
} from '@omnidocs/schema';

export interface IndexerOptions {
  /** Directory containing markdown docs (default: `docs`). */
  docsRoot?: string;
  /** Repository root used to resolve code_refs/test_refs (default: process.cwd()). */
  repoRoot?: string;
  /** Skip markdown files without (or with invalid) frontmatter instead of failing. */
  allowMissingFrontmatter?: boolean;
  /** Paths to exclude, matched against the repo-relative path. */
  ignore?: string[];
}

export interface IndexerResult {
  manifest: DocManifest;
  graph: RelationGraph;
  errors: string[];
  warnings: string[];
}

interface ParseOutcome {
  filePath: string;
  slug: string;
  item: DocItem;
  validRefs: RelationEdge[];
  warnings: string[];
}

const DEFAULT_IGNORES = ['node_modules', '.git', '.next', 'dist/', 'archive/'];

/** Recursively collect every `*.md` file under a root. */
export function scanMarkdownFiles(docsRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') walk(full);
      } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(docsRoot);
  return out.sort();
}

/** Extract ATX headings (`#`..`######`) plus a GitHub-style anchor slug. */
export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  const re = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    headings.push({ depth: m[1].length, text: m[2].trim(), slug: slugify(m[2]) });
  }
  return headings;
}

/** GitHub-compatible slug: lowercase, drop non-word chars, spaces -> hyphens. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Resolve a possibly-repo-root-relative list of refs to absolute paths; report misses. */
export function resolveRefs(refs: string[], repoRoot: string, warnings: string[]): RelationEdge[] {
  const edges: RelationEdge[] = [];
  for (const ref of refs) {
    const abs = path.resolve(repoRoot, ref);
    if (fs.existsSync(abs)) {
      edges.push({ source: '', target: ref, type: 'code_ref' });
    } else {
      warnings.push(`Dead reference (does not exist): ${ref}`);
    }
  }
  return edges;
}

/** Parse a single file into a DocItem, collecting warnings. */
export function parseDocFile(
  absolutePath: string,
  docsRoot: string,
  repoRoot: string,
  allowMissingFrontmatter: boolean,
): ParseOutcome | { missing: true; filePath: string } {
  const repoRelative = path.relative(repoRoot, absolutePath).split(path.sep).join('/');
  const raw = fs.readFileSync(absolutePath, 'utf-8');
  const { data, content } = matter(raw);

  const zod = DocMetadataSchema.safeParse(data);
  if (!zod.success) {
    if (allowMissingFrontmatter) return { missing: true, filePath: repoRelative };
    return {
      filePath: repoRelative,
      slug: '',
      item: null as never,
      validRefs: [],
      warnings: [
        `Frontmatter invalid or incomplete for ${repoRelative}: ${zod.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      ],
    };
  }

  const meta = zod.data;
  const warnings: string[] = [];

  // Dead-reference prevention: code_refs / test_refs must physically exist.
  for (const ref of meta.code_refs) {
    if (!fs.existsSync(path.resolve(repoRoot, ref))) {
      warnings.push(`${meta.id} code_ref does not exist: ${ref}`);
    }
  }
  for (const ref of meta.test_refs) {
    if (!fs.existsSync(path.resolve(repoRoot, ref))) {
      warnings.push(`${meta.id} test_ref does not exist: ${ref}`);
    }
  }
  const validRefs: RelationEdge[] = [...meta.code_refs, ...meta.test_refs]
    .filter((ref) => fs.existsSync(path.resolve(repoRoot, ref)))
    .map((ref) => ({ source: meta.id, target: ref, type: ref.startsWith('tests') ? 'test_ref' : 'code_ref' }));

  // Strip frontmatter from the body before counting words.
  const body = content.trim();
  const wordCount = body.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 400));
  const relativeToDocs = path.relative(docsRoot, absolutePath).split(path.sep).join('/');

  const item: DocItem = {
    ...meta,
    slug: relativeToDocs.replace(/\.(md|mdx)$/, ''),
    filePath: repoRelative,
    headings: extractHeadings(body),
    wordCount,
    readingTimeMinutes,
  };

  return { filePath: repoRelative, slug: item.slug, item, validRefs, warnings };
}

/**
 * Build the manifest + relation graph from a docs directory.
 * Throws after collecting errors unless `allowMissingFrontmatter` is set.
 */
export function buildIndex(opts: IndexerOptions = {}): IndexerResult {
  const docsRoot = path.resolve(opts.docsRoot ?? 'docs');
  const repoRoot = path.resolve(opts.repoRoot ?? process.cwd());
  const ignore = opts.ignore ?? [];
  const allowMissing = opts.allowMissingFrontmatter ?? false;

  const files = scanMarkdownFiles(docsRoot).filter((f) => {
    const rel = path.relative(repoRoot, f).split(path.sep).join('/');
    return ![...DEFAULT_IGNORES, ...ignore].some((pat) => rel.includes(pat) || rel.startsWith(pat));
  });

  const docs: DocItem[] = [];
  const edges: RelationEdge[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const f of files) {
    const parsed = parseDocFile(f, docsRoot, repoRoot, allowMissing);
    if ('missing' in parsed) continue;
    if (parsed.item === null) {
      // Strict mode: missing/invalid frontmatter is a blocking error.
      errors.push(...parsed.warnings);
      continue;
    }
    docs.push(parsed.item);
    edges.push(...parsed.validRefs);
    warnings.push(...parsed.warnings);
  }

  // same_domain edges: pair docs sharing >=1 domain.
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const shared = docs[i].domains.filter((d) => docs[j].domains.includes(d as any));
      if (shared.length > 0) {
        edges.push({ source: docs[i].id, target: docs[j].id, type: 'same_domain' });
      }
    }
  }

  const generatedAt = new Date().toISOString();
  const manifest: DocManifest = {
    contractVersion: DOCS_CONTRACT_VERSION,
    generatedAt,
    docCount: docs.length,
    docs,
  };
  const graph: RelationGraph = { contractVersion: DOCS_CONTRACT_VERSION, generatedAt, nodes: docs, edges };

  if (errors.length > 0) {
    throw new Error(
      `[OmniDocs] ${errors.length} blocking error(s):\n  ` + errors.slice(0, 20).join('\n  '),
    );
  }

  return { manifest, graph, errors, warnings };
}

/** Serialize build output to disk. Returns written file paths. */
export function writeIndex(outputDir: string, result: IndexerResult): string[] {
  fs.mkdirSync(outputDir, { recursive: true });
  const manifestPath = path.join(outputDir, 'docs-manifest.json');
  const graphPath = path.join(outputDir, 'relation-graph.json');
  fs.writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2));
  fs.writeFileSync(graphPath, JSON.stringify(result.graph, null, 2));
  return [manifestPath, graphPath];
}

export { injectFrontmatter, type InjectorOptions, type InjectResult } from './inject.js';