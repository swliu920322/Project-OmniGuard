'use client';

/**
 * Content Interpreter — P1 Kernel v3 (AI+app).
 *
 * 从"选表单"升级为"说意图"：输入一句话，模型决定怎么呈现，
 * 代码只负责把模型决定的语义参数安全落地。信不过时规则兜底。
 * 渲染永远吃 sanitize 后的合法 spec —— 模型填参数，代码做边界。
 */
import { useMemo, useState } from 'react';
import {
  fromAdr,
  fromBlueprint,
  Interpret,
  getPreset,
  FORM_PRESETS,
  type FormSpec,
  type DocumentContent,
  type FormKey,
} from '@omnidocs/interpreter';
import { ADR_025 } from './content';
import { BP_04 } from './blueprint-content';
import { resolveIntentLocalFirst } from './local-gpu';

export type DocKey = 'adr025' | 'bp04';

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

/**
 * 从当前 spec 反推"最接近的内置预设"，用于按钮高亮。
 * AI 决定/表单切换都统一走 spec 状态，避免 form+spec 双状态打架。
 */
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

function Switcher<T extends string>({
  current,
  options,
  onSwitch,
}: {
  current: T;
  options: Record<T, string>;
  onSwitch: (k: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 gap-1 shadow-2xl">
      {(Object.keys(options) as T[]).map((k) => {
        const active = k === current;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onSwitch(k)}
            tabIndex={0}
            aria-pressed={active}
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

export default function InterpreterDemo({
  content,
  initialForm = 'academic',
}: {
  content: DocKey;
  initialForm?: FormKey;
}) {
  const [docKey, setDocKey] = useState<DocKey>(content);
  // 单一 spec 状态：表单按钮 / AI 决定都写到它。没有第二个状态可打架。
  const [spec, setSpec] = useState<FormSpec>(() => getPreset(initialForm));
  const [intent, setIntent] = useState('');
  const [pending, setPending] = useState(false);
  const [intentMeta, setIntentMeta] = useState<{ mode: string; matched: string; description: string } | null>(null);

  const revealKey = useMemo(() => Date.now(), [docKey, spec]);

  const doc = useMemo(() => lexDoc(docKey), [docKey]);
  const form = nearestPreset(spec);

  async function submitIntent() {
    const text = intent.trim();
    if (!text || pending) return;
    setPending(true);
    try {
      const r = await resolveIntentLocalFirst(text);
      setSpec(r.spec);
      setIntentMeta({ mode: r.mode, matched: r.matched, description: r.description });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-900 flex flex-col items-center gap-6 p-8">
      <div className="max-w-3xl w-full flex flex-col items-stretch gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">
              Content Interpreter · AI + App
            </p>
            <h1 className="text-2xl font-bold text-white">
              Say intent. Model decides. Code renders.
            </h1>
          </div>
          <Switcher current={form} options={FORM_LABELS} onSwitch={(k) => { setSpec(getPreset(k)); setIntentMeta(null); }} />
        </div>

        {/* Natural-language intent entry */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 shadow-xl">
          <label htmlFor="intent" className="mb-2 block text-xs uppercase tracking-widest text-slate-400">
            Say what you want — the AI decides the form
          </label>
          <div className="flex gap-2">
            <input
              id="intent"
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitIntent()}
              placeholder='e.g. "An ops runbook in English, steps only"'
              className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none ring-1 ring-slate-700 focus:ring-amber-400"
            />
            <button
              type="button"
              onClick={submitIntent}
              disabled={pending || !intent.trim()}
              className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              {pending ? 'Deciding…' : 'Decide'}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTENT_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => { setIntent(ex); }}
                className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:border-amber-400 hover:text-amber-300"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {intentMeta && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
            <span className="mr-2 font-bold text-amber-300">
              {intentMeta.mode === 'llm' ? 'Model decision' : 'Rule fallback'} · {intentMeta.matched}
            </span>
            <span className="text-amber-200/80">{intentMeta.description}</span>
          </div>
        )}

        <Switcher current={docKey} options={DOC_LABELS} onSwitch={setDocKey} />
      </div>

      <Interpret key={revealKey} doc={doc} spec={spec} />
    </div>
  );
}