/**
 * Content Interpreter — sanitize (TRUST BOUNDARY for model output).
 *
 * LLM 输出是"不可信输入"。sanitizeFormSpec 接收任意 JSON，逐轴校验，
 * 非法值一律兜到对应默认档（academic）。任何经过此函数的 spec 都保证
 * 落在合法语义域内，渲染层永不接触模型的原始字符串。
 *
 * 允许模型：
 *   - 引用内置预设："academic" | "playbook" | "narrative"
 *   - 输出受控的语义 Fragment（仅列允许的枚举域字段）
 * 任何未列出的字段被忽略 —— 模型不能通过注入未知键来逃逸边界。
 */
import type { FormSpec, FormKey, LanguagePolicy, FontFamily, TextScale, SurfaceTone, WidthScale, HeaderTreat, FormulaTreat, SectionDivider, ListMarker, CalloutBorder, RevealMotion } from './form-spec.js';
import { getPreset, FORM_PRESETS } from './form-spec.js';

export type SanitizableSpec = Partial<{
  preset: FormKey;
  surface: { tone?: SurfaceTone };
  typography: { family?: FontFamily; scale?: TextScale };
  structure: { width?: WidthScale; header?: HeaderTreat; formula?: FormulaTreat; divider?: SectionDivider };
  density: { lang?: LanguagePolicy; collapseSections?: boolean; showAbstract?: boolean };
  rhythm: { listMarker?: ListMarker; calloutBorder?: CalloutBorder };
  motion: { reveal?: RevealMotion; stagger?: boolean };
}>;

const ALLOWED_LANG: LanguagePolicy[] = ['dual', 'en', 'zh'];
const ALLOWED_FAMILY: FontFamily[] = ['serif', 'sans', 'mono'];
const ALLOWED_SCALE: TextScale[] = ['compact', 'body', 'display'];
const ALLOWED_TONE: SurfaceTone[] = ['paper', 'terminal', 'warm'];
const ALLOWED_WIDTH: WidthScale[] = ['narrow', 'medium', 'wide'];
const ALLOWED_HEADER: HeaderTreat[] = ['centered', 'terminal', 'hero'];
const ALLOWED_FORMULA: FormulaTreat[] = ['fraction', 'inline-mono', 'highlight-card'];
const ALLOWED_DIVIDER: SectionDivider[] = ['numbered', 'lines', 'space'];
const ALLOWED_MARKER: ListMarker[] = ['decimal', 'check', 'disc'];
const ALLOWED_CALLOUT: CalloutBorder[] = ['left-rule', 'filled', 'bracket'];
const ALLOWED_REVEAL: RevealMotion[] = ['academic', 'playbook', 'narrative'];

function pick<T>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** 只收集模型允许触碰的字段；其余键全部丢弃。 */
export function sanitizeFormSpec(input: unknown): FormSpec {
  const fallback = FORM_PRESETS.academic;

  if (typeof input !== 'object' || input === null) return fallback;

  const raw = input as Record<string, unknown>;

  // 快捷路径：模型直接引用内置预设（必须精确命中，否则不信任，回退 academic）
  if (typeof raw.preset === 'string') {
    if (raw.preset in FORM_PRESETS) return FORM_PRESETS[raw.preset as FormKey];
    return fallback;
  }

  const s = (raw.surface ?? {}) as Record<string, unknown>;
  const t = (raw.typography ?? {}) as Record<string, unknown>;
  const st = (raw.structure ?? {}) as Record<string, unknown>;
  const d = (raw.density ?? {}) as Record<string, unknown>;
  const r = (raw.rhythm ?? {}) as Record<string, unknown>;
  const m = (raw.motion ?? {}) as Record<string, unknown>;

  return {
    key: 'model',
    label: '模型定制',
    sub: '语义参数 · 受限自由',
    surface: { tone: pick(s.tone, ALLOWED_TONE, fallback.surface.tone) },
    typography: {
      family: pick(t.family, ALLOWED_FAMILY, fallback.typography.family),
      scale: pick(t.scale, ALLOWED_SCALE, fallback.typography.scale),
    },
    structure: {
      width: pick(st.width, ALLOWED_WIDTH, fallback.structure.width),
      header: pick(st.header, ALLOWED_HEADER, fallback.structure.header),
      formula: pick(st.formula, ALLOWED_FORMULA, fallback.structure.formula),
      divider: pick(st.divider, ALLOWED_DIVIDER, fallback.structure.divider),
    },
    density: {
      lang: pick(d.lang, ALLOWED_LANG, fallback.density.lang),
      collapseSections: pickBool(d.collapseSections, fallback.density.collapseSections),
      showAbstract: pickBool(d.showAbstract, fallback.density.showAbstract),
    },
    rhythm: {
      listMarker: pick(r.listMarker, ALLOWED_MARKER, fallback.rhythm.listMarker),
      calloutBorder: pick(r.calloutBorder, ALLOWED_CALLOUT, fallback.rhythm.calloutBorder),
    },
    motion: {
      reveal: pick(m.reveal, ALLOWED_REVEAL, fallback.motion.reveal),
      stagger: pickBool(m.stagger, fallback.motion.stagger),
    },
  };
}

/** 从模型产物生成可读的决策说明（用于解释"为什么这样呈现"）。 */
export function describeSpec(spec: FormSpec): string {
  const axis: string[] = [];
  if (['dual', 'zh', 'en'].includes(spec.density.lang)) {
    const langNames: Record<string, string> = { dual: '双语', zh: '中文为主', en: '英文为主' };
    axis.push(langNames[spec.density.lang]);
  }
  const toneNames: Record<string, string> = { paper: '学术纸面', terminal: '终端暗色', warm: '暖色叙事' };
  axis.push(toneNames[spec.surface.tone] ?? spec.surface.tone);
  const scaleNames: Record<string, string> = { compact: '紧凑', body: '常规', display: '大字' };
  axis.push(scaleNames[spec.typography.scale] ?? spec.typography.scale);
  if (spec.density.collapseSections) axis.push('章节可折叠');
  if (!spec.density.showAbstract) axis.push('摘要隐藏');
  return axis.join(' · ');
}

/** 供消费方使用的完整入口：就一份原始输出返回合法 spec。 */
export function sanitizeAndDescribe(input: unknown): { spec: FormSpec; description: string };
export function sanitizeAndDescribe(input: unknown, describe: true): { spec: FormSpec; description: string };
export function sanitizeAndDescribe(input: unknown, describe: false): FormSpec;
export function sanitizeAndDescribe(input: unknown, describe?: boolean) {
  const spec = sanitizeFormSpec(input);
  if (describe === false) return spec;
  return { spec, description: describeSpec(spec) };
}

export { getPreset };