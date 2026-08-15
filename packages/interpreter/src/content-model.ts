/**
 * Content Interpreter — universal content model.
 *
 * The interpreter must not know it is rendering an ADR vs a Blueprint.
 * It only knows blocks: heading / paragraph / formula / list / callout.
 *
 * A "lexer" converts a domain-specific content shape (e.g. AdrContent)
 * into this generic DocumentContent. Adding a new document type = writing a
 * lexer, never touching the render engine.
 */

export interface BilingualText {
  en: string;
  zh: string;
}

export interface HeadingBlock {
  type: 'heading';
  depth: number;
  text: BilingualText;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: BilingualText;
}

export interface FormulaBlock {
  type: 'formula';
  label?: BilingualText;
  /** Raw inline math string, e.g. "V_max ≤ D / (L + T/S)" */
  value: string;
}

export interface CalloutBlock {
  type: 'callout';
  title?: BilingualText;
  text: BilingualText;
}

export interface ListItem {
  text: BilingualText;
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

export interface TableCell {
  text: BilingualText;
}

export interface TableBlock {
  type: 'table';
  headers?: BilingualText[];
  rows: TableCell[][];
}

export type ContentBlock = HeadingBlock | ParagraphBlock | FormulaBlock | CalloutBlock | ListBlock | TableBlock;

export interface DocumentContent {
  id: string;
  docType: string;
  status: string;
  title: BilingualText;
  abstract?: BilingualText;
  blocks: ContentBlock[];
}

export const DEFAULT_CONTENT: DocumentContent = {
  id: '',
  docType: '',
  status: '',
  title: { en: '', zh: '' },
  blocks: [],
};

/** Optionally slice out blocks by predicate — used for density policies. */
export function filterBlocks(doc: DocumentContent, keep: (b: ContentBlock) => boolean): ContentBlock[] {
  return doc.blocks.filter(keep);
}