#!/usr/bin/env node
import { buildIndex, writeIndex, injectFrontmatter } from './index.js';
import path from 'node:path';
import process from 'node:process';

/* ------------------------------------------------------------------ */
/* build 子命令                                                         */
/* ------------------------------------------------------------------ */

interface BuildArgs {
  docsRoot: string;
  outDir: string;
  allowMissing: boolean;
  ignore: string[];
}

function parseBuildArgs(argv: string[]): BuildArgs {
  const args: BuildArgs = { docsRoot: 'docs', outDir: 'generated/docs', allowMissing: false, ignore: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => argv[++i];
    switch (a) {
      case '--docs-root': args.docsRoot = next(); break;
      case '--out': args.outDir = next(); break;
      case '--allow-missing': args.allowMissing = true; break;
      case '--ignore': args.ignore.push(...next().split(',')); break;
      default: break;
    }
  }
  return args;
}

function cmdBuild(args: BuildArgs): number {
  const repoRoot = process.cwd();
  console.log(`[OmniDocs] indexing docs at ${args.docsRoot} (repo root: ${repoRoot})`);
  let result;
  try {
    result = buildIndex({
      docsRoot: path.resolve(repoRoot, args.docsRoot),
      repoRoot,
      allowMissingFrontmatter: args.allowMissing,
      ignore: args.ignore,
    });
  } catch (err) {
    console.error('[OmniDocs] ❌ ' + (err instanceof Error ? err.message : String(err)));
    return 1;
  }

  if (result.warnings.length > 0) {
    console.warn('[OmniDocs] ⚠️  warnings:');
    for (const w of result.warnings) console.warn('  - ' + w);
  }

  const written = writeIndex(path.resolve(repoRoot, args.outDir), result);
  console.log(
    `[OmniDocs] ✅ ${result.manifest.docCount} docs indexed → ${written
      .map((p) => path.relative(repoRoot, p))
      .join(', ')}`,
  );
  return 0;
}

/* ------------------------------------------------------------------ */
/* inject 子命令                                                        */
/* ------------------------------------------------------------------ */

interface InjectArgs {
  docsRoot: string;
  targets: string[];
  includeArchive: boolean;
}

function parseInjectArgs(argv: string[]): InjectArgs {
  const args: InjectArgs = { docsRoot: 'docs', targets: [], includeArchive: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => argv[++i];
    switch (a) {
      case '--docs-root': args.docsRoot = next(); break;
      case '--targets': args.targets.push(...next().split(',')); break;
      case '--include-archive': args.includeArchive = true; break;
      default: break;
    }
  }
  return args;
}

function cmdInject(args: InjectArgs): number {
  console.log(`[OmniDocs] injecting frontmatter under ${args.docsRoot}...`);
  const { injected, skipped, unsupported } = injectFrontmatter({
    docsRoot: args.docsRoot,
    targets: args.targets.length ? args.targets : undefined,
    includeArchive: args.includeArchive,
  });
  for (const item of injected) console.log(`  ✓ ${item.id}  ${item.relPath}`);
  console.log(
    `[OmniDocs] ${injected.length} injected, ${skipped} already had frontmatter, ${unsupported.length} unsupported`,
  );
  if (injected.length === 0 && unsupported.length > 0) {
    console.warn(`[OmniDocs] ⚠️  unsupported files (no derivation rule): ${unsupported.join(', ')}`);
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* 入口                                                                */
/* ------------------------------------------------------------------ */

function printHelp(): void {
  console.log(
    [
      'OmniDocs CLI — build-time index, manifest and frontmatter tooling.',
      '',
      'Usage: omnidocs <command> [options]',
      '',
      'Commands:',
      '  build   Scan markdown, validate frontmatter, emit docs-manifest.json + relation-graph.json.',
      '          --docs-root <dir>    markdown source directory (default: docs)',
      '          --out <dir>          output dir (default: generated/docs)',
      '          --repo-root <dir>    repo root for resolving code_refs/test_refs (default: cwd)',
      '          --allow-missing      skip files with missing/invalid frontmatter instead of failing',
      '          --ignore <a,b>       extra relative-path segments to exclude',
      '',
      '  inject  Batch-inject compliant YAML frontmatter into legacy docs (idempotent).',
      '          --docs-root <dir>    markdown source directory (default: docs)',
      '          --targets <a,b>      target sub-paths; "." = root-level files (default: all tracked categories)',
      '          --include-archive    also process files under archive/',
      '',
      '  help    Show this help.',
    ].join('\n'),
  );
}

function main(argv: string[]): number {
  // 全局 --repo-root：先切换到工作根，再让子命令的相对路径自然解析。
  const rrIdx = argv.indexOf('--repo-root');
  if (rrIdx !== -1 && argv[rrIdx + 1]) {
    process.chdir(path.resolve(argv[rrIdx + 1]));
    argv.splice(rrIdx, 2);
  }
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'build': return cmdBuild(parseBuildArgs(rest));
    case 'inject': return cmdInject(parseInjectArgs(rest));
    case 'help': case '-h': case '--help': printHelp(); return 0;
    default:
      printHelp();
      return cmd === undefined ? 0 : 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}

export { main };