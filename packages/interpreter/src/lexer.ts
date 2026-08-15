/**
 * Content Interpreter — lexers.
 *
 * A lexer converts a domain-specific content shape into the universal
 * DocumentContent model. Writing a new lexer is how a new document type is
 * supported — the render engine never changes.
 */

export interface BilingualBlock {
  zh: string;
  en: string;
}

export interface AdrContent {
  id: string;
  docType: string;
  status: string;
  title: BilingualBlock;
  abstract: BilingualBlock;
  formula: string;
  formulaLabel: BilingualBlock;
  context: BilingualBlock;
  drivers: BilingualBlock[];
  decision: BilingualBlock;
  consequences: BilingualBlock[];
}

import type { DocumentContent } from './content-model.js';

/**
 * ADR → generic document. Fields map onto the universal block vocabulary:
 *   context      → callout
 *   drivers      → list
 *   decision     → paragraph
 *   consequences → callout
 *   formula      → formula block
 */
export function fromAdr(adr: AdrContent): DocumentContent {
  return {
    id: adr.id,
    docType: adr.docType,
    status: adr.status,
    title: { en: adr.title.en, zh: adr.title.zh },
    abstract: adr.abstract && { en: adr.abstract.en, zh: adr.abstract.zh },
    blocks: [
      {
        type: 'formula',
        label: adr.formulaLabel && { en: adr.formulaLabel.en, zh: adr.formulaLabel.zh },
        value: adr.formula,
      },
      { type: 'callout', title: { en: 'Context', zh: '背景' }, text: { en: adr.context.en, zh: adr.context.zh } },
      {
        type: 'list',
        ordered: false,
        items: adr.drivers.map((d) => ({ text: { en: d.en, zh: d.zh } })),
      },
      { type: 'paragraph', text: { en: adr.decision.en, zh: adr.decision.zh } },
      {
        type: 'callout',
        title: { en: 'Consequences', zh: '后果' },
        text: { en: adr.consequences.map((c) => c.en).join(' '), zh: adr.consequences.map((c) => c.zh).join(' ') },
      },
    ],
  };
}

export type { ContentBlock, DocumentContent } from './content-model.js';

/**
 * Blueprint — a rendered "architecture plan" doc. Sections map onto the
 * universal block vocabulary. Same immutable idea as ADR: encoded once,
 * interpreted into forms by the engine — never rewritten.
 */
export interface BlueprintContent {
  id: string;
  docType: string;
  status: string;
  title: BilingualBlock;
  abstract?: BilingualBlock;
  /** Problem framing / current state. */
  context: BilingualBlock;
  /** Vision rows: capability → status → priority. */
  gapMatrix: Array<{
    capability: BilingualBlock;
    status: BilingualBlock;
    importance: BilingualBlock;
  }>;
  /** Ordered implementation steps. */
  steps: Array<{ title: BilingualBlock; body: BilingualBlock }>;
  /** Definition-of-done checklist. */
  acceptance: BilingualBlock[];
}

export function fromBlueprint(bp: BlueprintContent): DocumentContent {
  const blocks: DocumentContent['blocks'] = [];
  if (bp.context) {
    blocks.push({
      type: 'callout',
      title: { en: 'Context', zh: '现状' },
      text: { en: bp.context.en, zh: bp.context.zh },
    });
  }
  if (bp.gapMatrix.length > 0) {
    blocks.push({
      type: 'table',
      headers: [
        { en: 'Capability', zh: '能力' },
        { en: 'Status', zh: '状态' },
        { en: 'Priority', zh: '优先级' },
      ],
      rows: bp.gapMatrix.map((g) => [
        { text: g.capability },
        { text: g.status },
        { text: g.importance },
      ]),
    });
  }
  if (bp.steps.length > 0) {
    blocks.push({
      type: 'list',
      ordered: true,
      items: bp.steps.map((s) => ({
        text: { en: `${s.title.en} — ${s.body.en}`, zh: `${s.title.zh} — ${s.body.zh}` },
      })),
    });
  }
  if (bp.acceptance.length > 0) {
    blocks.push({
      type: 'list',
      ordered: false,
      items: bp.acceptance.map((a) => ({ text: { en: a.en, zh: a.zh } })),
    });
  }
  return {
    id: bp.id,
    docType: bp.docType,
    status: bp.status,
    title: { en: bp.title.en, zh: bp.title.zh },
    abstract: bp.abstract ? { en: bp.abstract.en, zh: bp.abstract.zh } : undefined,
    blocks,
  };
}