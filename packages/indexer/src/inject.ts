import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { scanMarkdownFiles } from './index.js';

/** OmniDocs Frontmatter Injector — 存量文档合规 Frontmatter 批量注入（幂等）。 */

export interface InjectorOptions {
  /** Directory containing markdown docs (default: `docs`). */
  docsRoot?: string;
  /** Target sub-paths; `'.'` matches root-level files only. Default covers all tracked categories. */
  targets?: string[];
  /** Also process files under `archive/` (default: excluded). */
  includeArchive?: boolean;
  /** Fail loudly on files we cannot derive metadata for (default: false). */
  strict?: boolean;
}

interface Rule {
  name: string | null;
  docType: string;
  domains: string[];
  perspectives: string[];
  layers: string[];
}

const TAG_MAP: Record<string, { layers: string[]; perspectives: string[]; domains: string[] }> = {
  infra: { layers: ['iac-infra'], perspectives: ['cloud-architecture'], domains: ['iac-bicep'] },
  backend: { layers: ['cloud-orchestrator'], perspectives: ['cloud-architecture'], domains: ['multi-agent'] },
  frontend: { layers: ['edge-client'], perspectives: ['frontend-engineering'], domains: ['edge-inference'] },
  ai: { layers: ['cloud-orchestrator'], perspectives: ['frontend-engineering'], domains: ['multi-agent'] },
  architecture: { layers: ['cross-cutting'], perspectives: ['cloud-architecture', 'frontend-engineering'], domains: ['multi-agent'] },
};

// 非 ADR/Blueprint 的目录 → 元数据映射
const DIR_RULES: Record<string, Rule> = {
  'README.md': { name: 'Documentation Home', docType: 'specification', domains: ['multi-agent'], perspectives: ['cloud-architecture', 'frontend-engineering', 'enterprise-audit'], layers: ['cross-cutting'] },
  'PROJECT_MEMORY.md': { name: 'Project Memory Map', docType: 'specification', domains: ['multi-agent'], perspectives: ['cloud-architecture', 'frontend-engineering'], layers: ['cross-cutting'] },
  'AI_NATIVE_DOC_SYSTEM_MASTER_PLAN.md': { name: 'OmniDocs Master Blueprint', docType: 'specification', domains: ['multi-agent'], perspectives: ['academic-research', 'cloud-architecture', 'frontend-engineering'], layers: ['cross-cutting'] },
  'adrs/_STANDARDS.md': { name: 'ADR Standards', docType: 'specification', domains: ['multi-agent'], perspectives: ['cloud-architecture'], layers: ['cross-cutting'] },
  'adrs/INDEX.md': { name: 'ADR Index', docType: 'specification', domains: ['multi-agent'], perspectives: ['cloud-architecture'], layers: ['cross-cutting'] },
  'audits/': { name: null, docType: 'specification', domains: ['multi-agent'], perspectives: ['enterprise-audit'], layers: ['cross-cutting'] },
  'dashboard/': { name: null, docType: 'playbook', domains: ['observability'], perspectives: ['frontend-engineering'], layers: ['edge-client'] },
  'tutorials/': { name: null, docType: 'tutorial', domains: ['multi-agent'], perspectives: ['cloud-architecture', 'frontend-engineering'], layers: ['cross-cutting'] },
  'plan/': { name: null, docType: 'specification', domains: ['multi-agent'], perspectives: ['cloud-architecture'], layers: ['cross-cutting'] },
  'reference/': { name: null, docType: 'specification', domains: ['multi-agent'], perspectives: ['cloud-architecture'], layers: ['cross-cutting'] },
};

const DEFAULT_TARGETS = ['.', 'adrs', 'reference/blueprints', 'audits', 'dashboard', 'tutorials', 'plan', 'reference'];

/** 为混合目录中的文件挑选规则；返回规则或 null (unsupported)。 */
function ruleFor(relPath: string): Rule | null {
  const rel = relPath.split(path.sep).join('/');
  if (DIR_RULES[rel]) return DIR_RULES[rel];
  for (const [prefix, rule] of Object.entries(DIR_RULES)) {
    if (rel.startsWith(prefix)) return rule;
  }
  return null;
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

function deriveMeta(relPath: string): { id: string; frontmatter: Record<string, unknown> } | null {
  const base = path.basename(relPath, path.extname(relPath));
  const rel = relPath.split(path.sep).join('/');
  const num = `00${Math.abs(hashCode(rel)) % 100}`.slice(-2);

  let id: string;
  let title: string;
  let docType: string;
  let status: string;
  let domains: string[];
  let perspectives: string[];
  let layers: string[];

  const adrMatch = rel.match(/adrs\/ADR-(\d{3})/);
  if (adrMatch) {
    const tagMatch = base.match(/^ADR-\d{3}-\[([a-z]+)\]-(.+)$/);
    const tag = tagMatch ? tagMatch[1] : 'architecture';
    const rules = TAG_MAP[tag] ?? TAG_MAP.architecture;
    id = `DOC-ADR-${adrMatch[1]}`;
    title = (tagMatch ? tagMatch[2] : base).replace(/-/g, ' ');
    docType = 'adr';
    status = 'accepted';
    domains = rules.domains;
    perspectives = rules.perspectives;
    layers = rules.layers;
  } else if (/reference\/blueprints\//.test(rel)) {
    const numMatch = base.match(/^(\d{2})-/);
    const rules = TAG_MAP.infra;
    id = `DOC-BP-${numMatch ? numMatch[1] : '00'}`;
    title = base.replace(/^\d{2}-/, '').replace(/-/g, ' ');
    docType = 'blueprint';
    status = 'accepted';
    domains = rules.domains;
    perspectives = ['cloud-architecture', 'enterprise-audit'];
    layers = ['iac-infra'];
  } else {
    const rule = ruleFor(rel);
    if (!rule) return null;
    const dirKey = rel.replace(/\//g, '-');
    id = `DOC-${dirKey.toUpperCase().replace(/[^A-Z0-9_-]/g, '-')}-${num}`;
    title = rule.name ?? base.replace(/^[\d-]+/, '').replace(/[-_]/g, ' ');
    docType = rule.docType;
    status = 'draft';
    domains = rule.domains;
    perspectives = rule.perspectives;
    layers = rule.layers;
  }

  const summary = `${title} — ${docType} reference auto-profiled into the OmniDocs multi-perspective index. (${rel})`;
  return {
    id,
    frontmatter: {
      id,
      title,
      summary,
      version: '1.0.0',
      updated_at: new Date().toISOString().slice(0, 10),
      authors: ['Shengwei Liu'],
      domains,
      perspectives,
      layers,
      doc_type: docType,
      status,
      code_refs: [],
      test_refs: [],
    },
  };
}

function frontmatterToYaml(data: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (key === 'domains' || key === 'perspectives' || key === 'layers' || key === 'authors') {
      lines.push(`${key}:`);
      for (const item of value as string[]) lines.push(`  - ${item}`);
    } else if (key === 'code_refs' || key === 'test_refs') {
      lines.push(`${key}: []`);
    } else {
      lines.push(`${key}: "${value}"`);
    }
  }
  return lines.join('\n');
}

export interface InjectResult {
  relPath: string;
  status: 'injected' | 'skip' | 'unsupported' | 'missing';
  id?: string;
}

/**
 * Scan a docs root and inject compliant frontmatter into files that lack it.
 * Idempotent: any file already carrying an `id`/`title` frontmatter is skipped.
 */
export function injectFrontmatter(opts: InjectorOptions = {}): {
  results: InjectResult[];
  injected: InjectResult[];
  skipped: number;
  unsupported: string[];
} {
  const docsRoot = path.resolve(opts.docsRoot ?? 'docs');
  const targets = opts.targets ?? DEFAULT_TARGETS;
  const includeArchive = opts.includeArchive ?? false;

  const files = scanMarkdownFiles(docsRoot).filter((f) => {
    const rel = path.relative(docsRoot, f).split(path.sep).join('/');
    const matchesTarget = targets.some((t) => (t === '.' ? !rel.includes('/') : rel.startsWith(t)));
    const isArchive = rel.startsWith('archive/');
    return matchesTarget && (includeArchive || !isArchive);
  });

  const results: InjectResult[] = files.map((file) => {
    const relPath = path.relative(docsRoot, file).split(path.sep).join('/');
    const raw = fs.readFileSync(file, 'utf-8');

    const existing = matter(raw);
    if (existing.data && (existing.data.id || existing.data.title)) {
      return { relPath, status: 'skip' as const };
    }

    const derived = deriveMeta(relPath);
    if (!derived) return { relPath, status: 'unsupported' as const };

    const yamlBlock = frontmatterToYaml(derived.frontmatter);
    const body = raw.replace(/^\s*/, '');
    fs.writeFileSync(file, `${yamlBlock}\n---\n\n${body}`);
    return { relPath, status: 'injected' as const, id: derived.id };
  });

  const injected = results.filter((r) => r.status === 'injected');
  const skipped = results.filter((r) => r.status === 'skip').length;
  const unsupported = results.filter((r) => r.status === 'unsupported').map((r) => r.relPath);

  return { results, injected, skipped, unsupported };
}