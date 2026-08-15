/**
 * Content Interpreter — intent → FormSpec (AI+app first leg).
 *
 * 用户说一句意图 → 尝试让模型产出 FormSpec（受限语义 JSON）；
 * 模型不可用/输出不合法时，规则引擎兜底。无论哪条路，返回的 spec
 * 都经过 sanitizeAndDescribe —— 信任边界在代码，渲染永不接触模型原始串。
 */
import {
  sanitizeAndDescribe,
  interpretIntent,
  RULE_MATCHES,
  type FormSpec,
} from '@omnidocs/interpreter';

export type IntentMode = 'llm' | 'rules';

export interface IntentResolution {
  spec: FormSpec;
  description: string;
  mode: IntentMode;
  matched: string;
}

const JSON_PROMPT = `You are the display parameter selector for a document interpreter.
Given the user's intent, choose a FormSpec. You may ONLY choose from these semantic enum values.
Return STRICT JSON (no markdown, no commentary) shaped EXACTLY like:
{"preset":"academic"}  OR  one of "playbook"|"narrative"
OR a fragment like {"surface":{"tone":"warm"},"density":{"lang":"zh"},"structure":{"formula":"highlight-card"}}.
Allowed values:
surface.tone: paper|terminal|warm
typography.family: serif|sans|mono
typography.scale: compact|body|display
structure.width: narrow|medium|wide
structure.header: centered|terminal|hero
structure.formula: fraction|inline-mono|highlight-card
structure.divider: numbered|lines|space
density.lang: dual|en|zh
density.collapseSections: true|false
density.showAbstract: true|false
rhythm.listMarker: decimal|check|disc
rhythm.calloutBorder: left-rule|filled|bracket
motion.reveal: academic|playbook|narrative
motion.stagger: true|false
Pick values that match the audience and language in the intent. Respond with JSON only.`;

/** 云端路径最长时间（秒）。后端 keep-alive 流不结束时用它兜底，绝不挂死 UI。 */
const CLOUD_TIMEOUT_MS = 8000;

async function tryCloudLLM(intent: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/chat/stream/?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `${JSON_PROMPT}\n\nIntent: ${intent}`, context: '/interpreter' }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) return null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let acc = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) acc += decoder.decode(value, { stream: true });
    }

    const start = acc.indexOf('{');
    const end = acc.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(acc.slice(start, end + 1));
    } catch {
      return null;
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      console.warn('[Intent] cloud path timed out, falling back to rules');
      return null;
    }
    console.warn('[Intent] cloud path failed:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export { tryCloudLLM };

/** 纯规则兜底（同步、零网络）：意图 → 规则 preset → 合法 spec。 */
export function ruleFallback(intent: string): IntentResolution {
  const r = interpretIntent(intent);
  return { spec: r.spec, description: describeSpecEn(r.spec), mode: 'rules', matched: matchedEn(intent, r) };
}

/** 规则引擎是否"有把握"（命中任意关键词，而非 academic 兜底）。 */
export function ruleHasConfidence(intent: string): boolean {
  const lower = intent.toLowerCase();
  // 与 package 规则保持一致：命中任意关键词即"有把握"。
  // academic 也是合法规则，不能仅凭 preset 名判断——否则"标准论文"会误判为无把握。
  return RULE_MATCHES.some((k) => lower.includes(k));
}

/** 把 package 的中文规则 label 映射成英文（用于英文演示 UI）。 */
function matchedEn(intent: string, r: { preset?: string }): string {
  switch (r.preset) {
    case 'playbook': return 'matched "ops runbook" pattern';
    case 'narrative': return 'matched "executive narrative" pattern';
    case 'academic': return ruleHasConfidence(intent) ? 'matched "formal paper" pattern' : 'no strong intent → academic (neutral)';
    default: return 'rule fallback';
  }
}

/** 英文版 spec 解读（替代 package 的中文 describeSpec）。 */
export function describeSpecEn(spec: FormSpec): string {
  const langNames: Record<string, string> = { dual: 'bilingual', zh: 'Chinese-first', en: 'English-first' };
  const toneNames: Record<string, string> = { paper: 'paper canvas', terminal: 'terminal dark', warm: 'warm narrative' };
  const scaleNames: Record<string, string> = { compact: 'compact', body: 'standard', display: 'large type' };
  const parts = [
    langNames[spec.density.lang] ?? spec.density.lang,
    toneNames[spec.surface.tone] ?? spec.surface.tone,
    scaleNames[spec.typography.scale] ?? spec.typography.scale,
  ];
  if (spec.density.collapseSections) parts.push('collapsible sections');
  if (!spec.density.showAbstract) parts.push('abstract hidden');
  return parts.join(' · ');
}

/**
 * 唯一入口：意图字符串 → 已消毒的合法 spec。
 * 优先 LLM，失败降级规则，永不 throw。
 */
export async function resolveIntent(intent: string): Promise<IntentResolution> {
  // 1) 模型路径
  try {
    const raw = await tryCloudLLM(intent);
    if (raw) {
      const { spec } = sanitizeAndDescribe(raw);
      console.log(`[Intent] model resolved: ${describeSpecEn(spec)}`);
      return { spec, description: describeSpecEn(spec), mode: 'llm', matched: 'model decision' };
    }
  } catch (err) {
    console.warn('[Intent] model path failed, falling back to rules:', err);
  }

  // 2) 规则兜底
  return ruleFallback(intent);
}