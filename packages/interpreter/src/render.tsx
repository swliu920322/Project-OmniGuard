/**
 * Content Interpreter — render engine.
 *
 * One engine, N parameter sets. The engine derives structure / density /
 * rhythm from a FormSpec; it NEVER hard-codes "which form is which". Every
 * presentational decision flows through the spec, so a new form is just a new
 * spec. Content is never mutated — only curated (language / abstract).
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  type BilingualText,
  type ContentBlock,
  type DocumentContent,
  type TableBlock,
  filterBlocks,
} from './content-model.js';
import type { FormSpec } from './form-spec.js';
import { specClasses, type SpecClasses } from './styles.js';

/* ------------------------------------------------------------------ */
/* Language policy helper — the ONLY place content is curated (non-mutating) */
/* ------------------------------------------------------------------ */

function langText(t: BilingualText, spec: FormSpec): string {
  switch (spec.density.lang) {
    case 'en':
      return t.en;
    case 'zh':
      return t.zh;
    default:
      return t.en; // dual: surface primary (en) in compact contexts
  }
}

function BilingualBody({ t, spec, cls }: { t: BilingualText; spec: FormSpec; cls: SpecClasses }) {
  if (spec.density.lang !== 'dual') {
    return <p className={cls.body + ' ' + cls.leading}>{langText(t, spec)}</p>;
  }
  return (
    <p>
      <span className={cls.body + ' ' + cls.leading}>{t.en}</span>
      <span className={'block mt-1 text-[0.85em] opacity-60 ' + cls.body}>
        {t.zh}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Formula renderers — three treatments, driven by spec, not by component  */
/* ------------------------------------------------------------------ */

function Fraction({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="inline-flex flex-col items-center align-middle leading-none px-1">
      <span className="border-b border-current px-1 pb-0.5">{num}</span>
      <span className="px-1 pt-0.5">{den}</span>
    </span>
  );
}

function FormulaInline({ value }: { value: string }) {
  return <span className="font-mono break-words whitespace-normal">{value}</span>;
}

function FormulaCard({ value, label, cls }: { value: string; label?: BilingualText; cls: SpecClasses }) {
  return (
    <div className={`rounded-2xl border px-8 py-6 ${cls.accent}`}>
      {label && (
        <p className="text-xs uppercase tracking-widest opacity-70 text-center mb-3">{label.en}</p>
      )}
      <p className="text-center font-medium text-xl break-words whitespace-normal leading-snug">{value}</p>
    </div>
  );
}

function FormulaFraction({ value, label, cls }: { value: string; label?: BilingualText; cls: SpecClasses }) {
  return (
    <div className={`rounded-lg border p-6 text-center overflow-x-auto ${cls.accent}`}>
      {label && <p className="text-[10px] uppercase opacity-60 mb-3">{label.en}</p>}
      <p className="font-mono text-base break-words whitespace-normal leading-snug">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section structure — dividers driven by spec                         */
/* ------------------------------------------------------------------ */

function Divider({ spec, cls, index }: { spec: FormSpec; cls: SpecClasses; index: number }) {
  switch (spec.structure.divider) {
    case 'numbered':
      return <span className={`text-sm uppercase tracking-widest ${cls.accent}`}>{index} </span>;
    case 'lines':
      return <span className="text-emerald-400 text-xs tracking-widest">## </span>;
    case 'space':
    default:
      return null;
  }
}

function Collapsible({ title, spec, cls, defaultOpen, children }: { title: string; spec: FormSpec; cls: SpecClasses; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cls.canvas}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:opacity-80 transition-colors cursor-pointer"
      >
        <span className={`text-xs tracking-widest ${cls.accent}`}>## {title}</span>
        <span className="text-xs opacity-60">{open ? '[-]' : '[+]'}</span>
      </button>
      {open && <div className="px-4 py-4">{children}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Block dispatcher — the engine core                                  */
/* ------------------------------------------------------------------ */

function renderBlock(block: ContentBlock, spec: FormSpec, cls: SpecClasses, index: number): ReactNode {
  switch (block.type) {
    case 'heading':
      return (
        <header className={spec.structure.header === 'centered' ? 'text-center mb-8' : 'mb-6'}>
          <h1 className={`${cls.accent} text-2xl font-bold`}>{langText(block.text, spec)}</h1>
        </header>
      );
    case 'paragraph':
      return <BilingualBody t={block.text} spec={spec} cls={cls} />;
    case 'callout':
      return (
        <section className={spec.rhythm.calloutBorder === 'left-rule' ? `border-l-2 pl-4 ${cls.accent}` : spec.rhythm.calloutBorder === 'bracket' ? `border-l-2 pl-5 ${cls.accent}` : `rounded-lg p-4 ${cls.accent}`}>
          {block.title && (
            <p className={`text-xs uppercase tracking-widest ${cls.accent} mb-2`}>{langText(block.title, spec)}</p>
          )}
          <BilingualBody t={block.text} spec={spec} cls={cls} />
        </section>
      );
    case 'formula':
      switch (spec.structure.formula) {
        case 'highlight-card':
          return <FormulaCard value={block.value} label={block.label} cls={cls} />;
        case 'inline-mono':
          return <FormulaInline value={block.value} />;
        case 'fraction':
        default:
          return <FormulaFraction value={block.value} label={block.label} cls={cls} />;
      }
    case 'table': {
      const t = block as TableBlock;
      return (
        <table className={`w-full text-left text-sm border-collapse ${cls.body}`}>
          {t.headers && (
            <thead>
              <tr>
                {t.headers.map((h, i) => (
                  <th key={i} className={`border-b pb-2 pr-3 font-semibold ${cls.accent}`}>
                    {langText(h, spec)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {t.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-dotted py-1.5 pr-3 align-top">
                    {langText(cell.text, spec)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case 'list': {
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => {
            const marker = spec.rhythm.listMarker === 'check' ? '[✓]' : spec.rhythm.listMarker === 'decimal' ? `${i + 1}.` : '·';
            return (
              <li key={i} className="flex gap-2">
                <span className={cls.accent}>{marker}</span>
                <BilingualBody t={item.text} spec={spec} cls={cls} />
              </li>
            );
          })}
        </ul>
      );
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Public surface                                                      */
/* ------------------------------------------------------------------ */

export interface InterpretOptions {
  /** Optional block filter applied BEFORE render (curation, not mutation). */
  keep?: (b: ContentBlock) => boolean;
}

/**
 * Interpret a document under a FormSpec. Pure function of (content, spec).
 * Re-mount with a new key to replay motion.
 */
export function Interpret({ doc, spec, opts }: { doc: DocumentContent; spec: FormSpec; opts?: InterpretOptions }) {
  const blocks = opts?.keep ? filterBlocks(doc, opts.keep) : doc.blocks;
  const sectioned = blocks.filter((b) => b.type !== 'heading');
  const cls = specClasses(spec);

  return (
    <article className={`${cls.canvas} ${cls.ink} ${cls.familyClass} ${cls.maxWidth} mx-auto px-8 py-10 ${cls.revealClass}`}>
      <header className={spec.structure.header === 'centered' ? 'text-center mb-8' : 'mb-8'}>
        <div className={`text-[10px] uppercase tracking-[0.25em] ${cls.accent} mb-4`}>
          {doc.docType} · {doc.id} · {doc.status}
        </div>
        <h1 className={`${spec.typography.family === 'mono' ? 'uppercase' : ''} text-3xl ${spec.typography.family === 'serif' ? 'font-semibold' : 'font-bold'} tracking-tight`}>
          {spec.density.lang === 'dual' ? (
            <>
              {doc.title.en}
              {doc.title.zh ? <span className={`block mt-1 text-lg ${cls.accent}`}>{doc.title.zh}</span> : null}
            </>
          ) : (
            langText(doc.title, spec)
          )}
        </h1>
      </header>

      {spec.density.showAbstract && doc.abstract && (
        <p className={`italic opacity-80 mb-8 ${spec.rhythm.calloutBorder === 'left-rule' ? 'border-l-2 pl-4' : ''}`}>
          {spec.density.lang === 'dual' ? (
            <>
              <span className={cls.body + ' ' + cls.leading}>{doc.abstract.en}</span>
              <span className={`block mt-1 text-[0.85em] opacity-70 ${cls.body}`}>
                {doc.abstract.zh}
              </span>
            </>
          ) : (
            <span className={cls.body + ' ' + cls.leading}>
              {spec.density.lang === 'zh' ? doc.abstract.zh : doc.abstract.en}
            </span>
          )}
        </p>
      )}

      <div className={`${cls.body} ${cls.leading} space-y-6`}>
        {sectioned.map((block, i) => {
          const content = renderBlock(block, spec, cls, i + 1);
          if (spec.density.collapseSections && (block.type === 'list' || block.type === 'callout' || block.type === 'paragraph')) {
            const label = block.type === 'list' ? 'LIST' : block.type === 'callout' ? (block.title ? langText(block.title, spec) : 'NOTE') : 'SECTION';
            return <Collapsible key={i} title={label} spec={spec} cls={cls} defaultOpen={true}>{content}</Collapsible>;
          }
          return <section key={i} className={spec.structure.divider === 'space' ? 'space-y-3' : ''}>
            {content}
          </section>;
        })}
      </div>
    </article>
  );
}