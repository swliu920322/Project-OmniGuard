/**
 * Content Interpreter — P1 Minimum Provable Kernel data.
 *
 * One document (ADR-025), one immutable content payload, three interpreter forms.
 * The content below is a faithful, structured encoding of:
 *   docs/adrs/ADR-025-[frontend]-Kinematic-Token-Theorem-Sandbox.md
 * Bilingual kept as-is from the source ADR.
 */

import type { AdrContent, BilingualBlock } from '@omnidocs/interpreter';
export type { AdrContent, BilingualBlock };

export const ADR_025: AdrContent = {
  id: 'DOC-ADR-025',
  docType: 'adr',
  status: 'accepted',
  title: {
    zh: 'Kinematic Token 定理沙盒',
    en: 'Kinematic Token Theorem Sandbox',
  },
  abstract: {
    en: 'Cloud-only LLM control loops carry two inherent latency sources — network RTT and token generation — during which an embodied vehicle moves blind. We bound the safe speed by a token-rate-deflated clearance margin, and prove it interactively in a zero-backend sandbox.',
    zh: '纯云 LLM 控制环路包含两处固有延迟——网络往返与 Token 生成，期间具身车辆盲行。本决策以令牌速率折算的净空余量约束安全速度，并在零后端沙盒中交互式证明。',
  },
  formula:
    'V_max ≤ D_clearance / (L_network_rtt + (T_prompt + T_completion) / S_token_rate)',
  formulaLabel: { zh: '最大安全速度', en: 'Max safe speed' },
  context: {
    en: 'Embodied AI systems (AGVs, robots, drones) operate under hard physical deadlines. A cloud-only LLM control loop has two unavoidable latency sources: network RTT and token generation time. During this total delay the vehicle continues moving blindly.',
    zh: '具身 AI 系统（AGV、机器人、无人机）在严格的物理时限下运行。纯云 LLM 控制环路有两个不可避免的延迟来源：网络 RTT 和 Token 生成时间。在此总延迟期间，车辆继续盲目移动。',
  },
  drivers: [
    {
      en: 'Zero backend dependency — pure client-side Next.js page.',
      zh: '零后端依赖——纯客户端 Next.js 页面。',
    },
    {
      en: 'Visual, interactive proof that cloud-only latency cannot safely control fast hardware.',
      zh: '可视化的交互式证明，纯云延迟无法安全控制快速硬件。',
    },
    {
      en: 'Reusable math kernel shared with fleet dashboard.',
      zh: '与舰队仪表板共享的可重用数学内核。',
    },
  ],
  decision: {
    en: 'Build a standalone sandbox using requestAnimationFrame-based animation, with a Component-Hook-Lib separation: page owns state, components own rendering, hooks own animation lifecycle, lib owns pure math. Provide Cloud-Only and Edge Fallback mode toggle, 6 parameter sliders, real-time V_max computation, and collision/safe-stop visualization.',
    zh: '构建一个独立沙盒，使用基于 requestAnimationFrame 的动画，实现组件-钩子-库分离：页面拥有状态，组件拥有渲染，钩子拥有动画生命周期，库拥有纯数学计算。提供纯云和边缘回退模式切换、6 个参数滑块、实时 V_max 计算以及碰撞/安全停止可视化。',
  },
  consequences: [
    {
      en: 'Fully offline, demo-able without any Azure subscription or backend.',
      zh: '完全离线，无需任何 Azure 订阅或后端即可演示。',
    },
    {
      en: 'Shared physics kernel reused by fleet simulation (ADR-009).',
      zh: '共享物理内核被舰队模拟重用（ADR-009）。',
    },
    {
      en: 'Clear before/after narrative — collision in Cloud-Only mode → safe stop in Edge Fallback.',
      zh: '清晰的之前/之后叙事——纯云模式下碰撞 → 边缘回退模式下安全停止。',
    },
  ],
};