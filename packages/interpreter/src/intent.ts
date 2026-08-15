/**
 * Content Interpreter — intent routing (自然语言 → FormSpec)。
 *
 * "AI+应用"的第一段：用户不说表单名，而说一句意图。
 * 这里用可读规则做【确定性兜底】，让 demo 在没有模型时也能演示
 * 意图 → 参数 的转换。接 LLM 后，这套规则成为降级路径 ——
 * 模型可用时让模型填参数，不可用时规则兜底，永不白屏。
 */
import type { FormSpec } from './form-spec.js';
import { getPreset } from './form-spec.js';
import { sanitizeFormSpec } from './sanitize.js';

export interface IntentResult {
  spec: FormSpec;
  preset?: 'academic' | 'playbook' | 'narrative';
  matched: string;
}

interface IntentRule {
  keywords: string[];
  preset: 'academic' | 'playbook' | 'narrative';
  label: string;
}

const RULES: IntentRule[] = [
  {
    keywords: ['运维', '操作', '手册', 'runbook', 'playbook', '步骤', '执行', 'run', 'ops', '告警', '恢复', '终端', 'procedures', 'operations'],
    preset: 'playbook',
    label: '像"给运维的操作手册"',
  },
  {
    keywords: ['汇报', '老板', '客户', '故事', '叙事', '长文', 'presentation', 'readme', '展示', '演讲', 'narrative', 'executive', 'story', 'summary'],
    preset: 'narrative',
    label: '像"给老板的汇报长文"',
  },
  {
    keywords: ['评审', '论文', '学术', '审查', 'review', '论文评审', '规范', '双语文档', 'bilingual', 'formal', 'paper'],
    preset: 'academic',
    label: '像"给评审的论文"',
  },
];

const RULE_MATCHES: string[] = RULES.flatMap((r) => r.keywords);

/**
 * 规则路由：分词后做子串匹配，命中关键词最多的预设胜出。
 * 无命中 → 默认 academic（安全中性）。
 * 返回的解读文本用作 UI 的"为什么这样选"。
 */
export function interpretIntent(intent: string): IntentResult {
  const lower = intent.toLowerCase();

  let bestRule: IntentRule | null = null;
  let bestScore = 0;
  for (const rule of RULES) {
    const score = rule.keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  const rule = bestRule ?? RULES[2]; // fallback academic
  const spec = bestScore > 0 ? getPreset(rule.preset) : getPreset('academic');
  return { spec, preset: (bestScore > 0 ? rule.preset : 'academic'), matched: rule.label };
}

/**
 * 统一意图解析：得到 raw（可能是 LLM JSON 或规则产物）时先 sanitize，
 * 保证返回的 spec 永远合法。这就是"模型填参数、代码负责安全落地"。
 */
export function resolveIntentIntent(intent: string, rawOverride?: unknown): IntentResult {
  if (rawOverride !== undefined) {
    return { spec: sanitizeFormSpec(rawOverride), matched: '模型定制' };
  }
  return interpretIntent(intent);
}

export { RULE_MATCHES };