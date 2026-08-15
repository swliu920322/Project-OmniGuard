/**
 * Content Interpreter — FormSpec (interpretation parameters).
 *
 * AI 边界契约：FormSpec 是【纯语义参数】。每个轴都是受限枚举域——
 * LLM/AI 只能在域内选值，永远不能输出 CSS class 或组件代码。
 * 语义 → CSS 的映射由 styles.ts 确定性完成（trust boundary 在代码，绝不在模型）。
 *
 * 这就是 "受限自由" 的工程含义：AI 填参数，它不写样式；代码负责把参数
 * 变成可靠的渲染。
 */

/** 语言策略：实际展示哪种语言（展示层取舍，不改内容）。 */
export type LanguagePolicy = 'dual' | 'en' | 'zh';

export type FontFamily = 'serif' | 'sans' | 'mono';

/** 正文密度档位（决定字号与行距的语义档，非像素值）。 */
export type TextScale = 'compact' | 'body' | 'display';

/** 画布气质：决定整体配色（前景/背景/强调色全部由此语义派生）。 */
export type SurfaceTone = 'paper' | 'terminal' | 'warm';

/** 版心宽度档位。 */
export type WidthScale = 'narrow' | 'medium' | 'wide';

/** 标题区结构。 */
export type HeaderTreat = 'centered' | 'terminal' | 'hero';

/** 公式呈现方式。 */
export type FormulaTreat = 'fraction' | 'inline-mono' | 'highlight-card';

/** 章节节奏分隔方式。 */
export type SectionDivider = 'numbered' | 'lines' | 'space';

/** 列表标记语义。 */
export type ListMarker = 'decimal' | 'check' | 'disc';

/** 警示框边框语义。 */
export type CalloutBorder = 'left-rule' | 'filled' | 'bracket';

/** 入场动效语义（对应 globals.css 里的 form-* 关键帧）。 */
export type RevealMotion = 'academic' | 'playbook' | 'narrative';

export interface FormSpec {
  key: string;
  label: string;
  sub: string;

  /** 画布 — 只有语义气质，无任何 class 字符串。 */
  surface: {
    tone: SurfaceTone;
  };

  /** 排版 — 族与档位均为语义值。 */
  typography: {
    family: FontFamily;
    scale: TextScale;
  };

  /** 结构 — 空间如何组织。 */
  structure: {
    width: WidthScale;
    header: HeaderTreat;
    formula: FormulaTreat;
    divider: SectionDivider;
  };

  /** 密度 — 展示什么信息 (immutable content, curated display)。 */
  density: {
    lang: LanguagePolicy;
    collapseSections: boolean;
    showAbstract: boolean;
  };

  /** 节奏 — 微纹理。 */
  rhythm: {
    listMarker: ListMarker;
    calloutBorder: CalloutBorder;
  };

  /** 动效 — 消费方通过 key remount 重放。 */
  motion: {
    reveal: RevealMotion;
    stagger: boolean;
  };
}

export type FormKey = 'academic' | 'playbook' | 'narrative';

/** 内置参考预设 — 三个参考形态。 */
export const FORM_PRESETS: Record<FormKey, FormSpec> = {
  academic: {
    key: 'academic',
    label: '学术论文',
    sub: 'Serif · 编号 · 双语',
    surface: { tone: 'paper' },
    typography: { family: 'serif', scale: 'body' },
    structure: { width: 'narrow', header: 'centered', formula: 'fraction', divider: 'numbered' },
    density: { lang: 'dual', collapseSections: false, showAbstract: true },
    rhythm: { listMarker: 'decimal', calloutBorder: 'left-rule' },
    motion: { reveal: 'academic', stagger: false },
  },
  playbook: {
    key: 'playbook',
    label: '运维手册',
    sub: 'Mono · 折叠 · 终端',
    surface: { tone: 'terminal' },
    typography: { family: 'mono', scale: 'compact' },
    structure: { width: 'medium', header: 'terminal', formula: 'inline-mono', divider: 'lines' },
    density: { lang: 'en', collapseSections: true, showAbstract: false },
    rhythm: { listMarker: 'check', calloutBorder: 'filled' },
    motion: { reveal: 'playbook', stagger: true },
  },
  narrative: {
    key: 'narrative',
    label: '叙事长卷',
    sub: 'Sans · 呼吸 · 中文',
    surface: { tone: 'warm' },
    typography: { family: 'sans', scale: 'display' },
    structure: { width: 'medium', header: 'hero', formula: 'highlight-card', divider: 'space' },
    density: { lang: 'zh', collapseSections: false, showAbstract: true },
    rhythm: { listMarker: 'disc', calloutBorder: 'bracket' },
    motion: { reveal: 'narrative', stagger: false },
  },
};

export function getPreset(key: string): FormSpec {
  return FORM_PRESETS[key as FormKey] ?? FORM_PRESETS.academic;
}