import type { BlueprintContent } from '@omnidocs/interpreter';

/**
 * Blueprint 04 — Observability Platform.
 * Faithful bilingual encoding of docs/reference/blueprints/04-observability-platform.md.
 * Second content source proving interpreter generality: new doc = new lexer.
 */
export const BP_04: BlueprintContent = {
  id: 'DOC-BP-04',
  docType: 'blueprint',
  status: 'accepted',
  title: { zh: '可观测平台蓝图', en: 'Observability Platform' },
  abstract: {
    en: 'From zero observability to a three-layer platform: metrics, logs and distributed traces, unified in Azure Monitor Workbooks with an alerting pipeline for fleet operations.',
    zh: '从零可观测到三层平台：指标、日志与分布式追踪，统一呈现于 Azure Monitor 工作簿，并为车队运营提供告警管道。',
  },
  context: {
    en: 'Today there is no custom dashboard, no alert rule, no distributed tracing, and no IoT telemetry monitoring. Application insights sampling is partial and logs are unreviewed.',
    zh: '当前无自定义仪表盘、无告警规则、无分布式追踪，也无 IoT 设备遥测监控。应用洞察采样不全，日志未结构化分析。',
  },
  gapMatrix: [
    { capability: { en: 'Application metrics', zh: '应用指标' }, status: { en: 'Partial', zh: '部分' }, importance: { en: 'High', zh: '高' } },
    { capability: { en: 'Custom business metrics', zh: '自定义业务指标' }, status: { en: 'None', zh: '无' }, importance: { en: 'High', zh: '高' } },
    { capability: { en: 'Distributed tracing', zh: '分布式追踪' }, status: { en: 'None', zh: '无' }, importance: { en: 'High', zh: '高' } },
    { capability: { en: 'Log analytics (KQL)', zh: '日志集中分析' }, status: { en: 'Partial', zh: '有' }, importance: { en: 'Medium', zh: '中' } },
    { capability: { en: 'Alert rules', zh: '告警规则' }, status: { en: 'None', zh: '无' }, importance: { en: 'High', zh: '高' } },
    { capability: { en: 'IoT telemetry monitoring', zh: 'IoT 设备遥测监控' }, status: { en: 'None', zh: '无' }, importance: { en: 'High', zh: '高' } },
  ],
  steps: [
    {
      title: { en: 'Deep Application Insights', zh: '应用洞察深度集成' },
      body: {
        en: 'Wire OpenTelemetry SDK into the Python backend, emit custom business metrics (device registration, message latency, agent pipeline time), and add browser telemetry.',
        zh: '为 Python 后端接入 OpenTelemetry SDK，上报自定义业务指标（设备注册、消息延迟、Agent 管线耗时），并补充浏览器端遥测。',
      },
    },
    {
      title: { en: 'Log analytics & KQL templates', zh: '日志分析与 KQL 模板' },
      body: {
        en: 'Curate repeatable KQL templates for application logs, flow failures and IoT message processing windows.',
        zh: '沉淀可复用的 KQL 查询模板，覆盖应用日志、流程失败与 IoT 消息处理窗口。',
      },
    },
    {
      title: { en: 'Azure Monitor Workbooks', zh: '监控工作簿' },
      body: {
        en: 'Compose live workbooks for the OmniGuard application and the fleet IoT status, unifying metrics and traces in one surface.',
        zh: '为 OmniGuard 应用与车队 IoT 状态编排实时工作簿，在单一界面统一指标与追踪。',
      },
    },
    {
      title: { en: 'Alert pipeline', zh: '告警管道' },
      body: {
        en: 'Define alert rules over metrics and logs, routed through Action Groups to e-mail, SMS, Teams and webhooks.',
        zh: '基于指标与日志定义告警规则，经 Action Groups 路由至邮件、短信、Teams 与 Webhook。',
      },
    },
  ],
  acceptance: [
    { en: 'Custom app metrics and tracing visible in one workbook', zh: '自定义应用指标与追踪在工作簿中可见' },
    { en: 'IoT fleet telemetry dashboard live', zh: 'IoT 车队遥测仪表盘实时可用' },
    { en: 'Alert fires and reaches the configured channel', zh: '告警可触发并到达所配置的通道' },
    { en: 'KQL templates cover the top-3 fleet queries', zh: 'KQL 模板覆盖车队三大查询场景' },
  ],
};