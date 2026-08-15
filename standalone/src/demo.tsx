/**
 * Content Interpreter — standalone static demo (GitHub Pages).
 *
 * 独立于 Next.js 的纯静态 demo：复用 @omnidocs/interpreter 引擎 + 规则意图路由。
 * 不加载本地 web-llm（静态托管无后端，本地模型下载慢）；云端路径失败时
 * 规则引擎自动兜底 —— 这正是"信任边界在代码"的现场演示。
 */
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  fromAdr,
  fromBlueprint,
  Interpret,
  getPreset,
  FORM_PRESETS,
  type FormSpec,
  type DocumentContent,
  type FormKey,
} from '../../packages/interpreter/dist/index.js';
import { ADR_025 } from '../../src/client-edge/src/components/interpreter/content.js';
import { BP_04 } from '../../src/client-edge/src/components/interpreter/blueprint-content.js';
import { ruleFallback, ruleHasConfidence, describeSpecEn } from '../../src/client-edge/src/components/interpreter/intent-llm.js';

type DocKey = 'adr025' | 'bp04';

const DOC_LABELS: Record<DocKey, string> = {
  adr025: 'ADR-025 · Kinematic Token',
  bp04: 'BP-04 · Observability Platform',
};

const FORM_LABELS: Record<FormKey, string> = {
  academic: 'Academic',
  playbook: 'Playbook',
  narrative: 'Narrative',
};

const INTENT_EXAMPLES = [
  'An ops runbook for the team, English, steps only',
  'A narrative summary for the executive, Chinese',
  'A formal bilingual paper for review',
];

function lexDoc(key: DocKey): DocumentContent {
  return key === 'adr025' ? fromAdr(ADR_025) : fromBlueprint(BP_04);
}

function nearestPreset(spec: FormSpec): FormKey {
  let best: FormKey = 'academic';
  let bestScore = -1;
  for (const key of Object.keys(FORM_PRESETS) as FormKey[]) {
    const p = FORM_PRESETS[key];
    let score = 0;
    if (p.surface.tone === spec.surface.tone) score++;
    if (p.typography.family === spec.typography.family) score++;
    if (p.typography.scale === spec.typography.scale) score++;
    if (p.structure.header === spec.structure.header) score++;
    if (p.structure.formula === spec.structure.formula) score++;
    if (p.structure.divider === spec.structure.divider) score++;
    if (p.density.lang === spec.density.lang) score++;
    if (p.density.collapseSections === spec.density.collapseSections) score++;
    if (p.density.showAbstract === spec.density.showAbstract) score++;
    if (p.rhythm.listMarker === spec.rhythm.listMarker) score++;
    if (p.rhythm.calloutBorder === spec.rhythm.calloutBorder) score++;
    if (p.motion.reveal === spec.motion.reveal) score++;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return best;
}

function Switcher<T extends string>({ current, options, onSwitch }: {
  current: T; options: Record<T, string>; onSwitch: (k: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 gap-1 shadow-2xl">
      {(Object.keys(options) as T[]).map((k) => {
        const active = k === current;
        return (
          <button
            key={k} type="button" onClick={() => onSwitch(k)} tabIndex={0} aria-pressed={active}
            className={`rounded-lg px-4 py-2 text-left transition-all duration-200 ${
              active ? 'bg-zinc-900 text-white shadow-lg scale-[1.02]' : 'text-zinc-600 hover:bg-slate-100'
            }`}
          >
            <span className="block text-sm font-bold">{options[k]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Demo() {
  const [docKey, setDocKey] = useState<DocKey>('adr025');
  const [spec, setSpec] = useState<FormSpec>(() => getPreset('academic'));
  const [intent, setIntent] = useState('');
  const [pending, setPending] = useState(false);
  const [intentMeta, setIntentMeta] = useState<{ matched: string; description: string } | null>(null);

  const revealKey = useMemo(() => Date.now(), [docKey, spec]);
  const doc = useMemo(() => lexDoc(docKey), [docKey]);
  const form = nearestPreset(spec);

  function submitIntent() {
    const text = intent.trim();
    if (!text || pending) return;
    setPending(true);
    // 静态 demo：规则引擎是唯一决策器（云端在静态托管不可用，无需尝试）。
    // 有意不接网络——"规则兜底"不是退路，而是这里的正式路径。
    setTimeout(() => {
      const r = ruleFallback(text);
      setSpec(r.spec);
      setIntentMeta({ matched: r.matched, description: describeSpecEn(r.spec) });
      setPending(false);
    }, 250); // 微延迟让"AI 在思考"的仪式感可见
  }

  return (
    <div className="min-h-full bg-slate-900 flex flex-col items-center gap-6 p-8">
      <div className="max-w-3xl w-full flex flex-col items-stretch gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Content Interpreter · AI + App</p>
            <h1 className="text-2xl font-bold text-white">Say intent. Model decides. Code renders.</h1>
          </div>
          <Switcher current={form} options={FORM_LABELS} onSwitch={(k) => { setSpec(getPreset(k)); setIntentMeta(null); }} />
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 shadow-xl">
          <label htmlFor="intent" className="mb-2 block text-xs uppercase tracking-widest text-slate-400">
            Say what you want — the interpreter decides the form
          </label>
          <div className="flex gap-2">
            <input
              id="intent" type="text" value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitIntent()}
              placeholder='e.g. "An ops runbook in English, steps only"'
              className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none ring-1 ring-slate-700 focus:ring-amber-400"
            />
            <button
              type="button" onClick={submitIntent} disabled={pending || !intent.trim()}
              className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              {pending ? 'Deciding…' : 'Decide'}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTENT_EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setIntent(ex)}
                className="rounded-full border border-slate-500 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:border-amber-400 hover:text-amber-200 hover:bg-slate-700">
                {ex}
              </button>
            ))}
          </div>
        </div>

        {intentMeta && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
            <span className="mr-2 font-bold text-amber-300">{intentMeta.matched}</span>
            <span className="text-amber-200/80">{intentMeta.description}</span>
          </div>
        )}

        <Switcher current={docKey} options={DOC_LABELS} onSwitch={setDocKey} />
      </div>

      <Interpret key={revealKey} doc={doc} spec={spec} />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<Demo />);
}