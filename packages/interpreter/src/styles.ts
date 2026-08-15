/**
 * Content Interpreter — styles mapper (semantic → render).
 *
 * TRUST BOUNDARY. FormSpec 只含语义参数（枚举域），本文件是唯一的
 * 语义 → CSS class 映射点。模型永不输出 class；这里用穷举表把每个语义值
 * 确定性地翻译成 Tailwind class。任何非法语义值在这里被兜到默认档，
 * 渲染永远不会吃到模型的原始字符串。
 */
import type { FormSpec } from './form-spec.js';

export interface SpecClasses {
  canvas: string;
  ink: string;
  accent: string;
  body: string;
  leading: string;
  maxWidth: string;
  revealClass: string;
  familyClass: string;
}

const TONES: Record<string, { canvas: string; ink: string; accent: string }> = {
  paper: { canvas: 'bg-white', ink: 'text-slate-900', accent: 'text-slate-700' },
  terminal: { canvas: 'bg-[#0a0f0a]', ink: 'text-emerald-100', accent: 'text-emerald-400' },
  warm: {
    canvas: 'bg-gradient-to-b from-orange-50 via-amber-50/40 to-white',
    ink: 'text-zinc-800',
    accent: 'text-amber-600',
  },
};

const SCALES: Record<string, { body: string; leading: string }> = {
  compact: { body: 'text-[13px]', leading: 'leading-relaxed' },
  body: { body: 'text-[15px]', leading: 'leading-loose' },
  display: { body: 'text-xl', leading: 'leading-relaxed' },
};

const WIDTHS: Record<string, string> = {
  narrow: 'max-w-2xl',
  medium: 'max-w-3xl',
  wide: 'max-w-4xl',
};

const FAMILIES: Record<string, string> = {
  serif: 'font-serif',
  sans: 'font-sans',
  mono: 'font-mono',
};

const REVEALS: Record<string, string> = {
  academic: 'form-academic',
  playbook: 'form-playbook',
  narrative: 'form-narrative',
};

export function specClasses(spec: FormSpec): SpecClasses {
  const tone = TONES[spec.surface.tone] ?? TONES.paper;
  const scale = SCALES[spec.typography.scale] ?? SCALES.body;
  const width = WIDTHS[spec.structure.width] ?? WIDTHS.narrow;
  const family = FAMILIES[spec.typography.family] ?? FAMILIES.sans;
  const reveal = REVEALS[spec.motion.reveal] ?? REVEALS.academic;

  return {
    canvas: tone.canvas,
    ink: tone.ink,
    accent: tone.accent,
    body: scale.body,
    leading: scale.leading,
    maxWidth: width,
    revealClass: reveal,
    familyClass: family,
  };
}