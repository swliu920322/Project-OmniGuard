import React from 'react';
import { useI18n } from '@/components/I18nProvider';
import { Layers } from 'lucide-react';

interface SkuOption {
  id: string;
  name: string;
  desc: string;
  perfSpec: string;
  monthlyCost: number;
  params: Record<string, any>;
}

interface SkuTuningSectionProps {
  selectedSkus: Record<string, string>;
  onSelectSku: (resType: string, optionId: string) => void;
  skuData: Record<string, SkuOption[]>;
  activeScenario: string;
}

const SKU_LOCALIZED_DATA: Record<string, Record<string, { zh: { name: string; desc: string; perfSpec: string }; en: { name: string; desc: string; perfSpec: string } }>> = {
  cosmosDb: {
    free: {
      zh: { name: 'Free Tier (免费级)', desc: '单区域, 免费 1000 RU/s, 适合开发测试', perfSpec: '吞吐上限 400-1000 RU/s | 无 SLA 保证' },
      en: { name: 'Free Tier', desc: 'Single region, free 1000 RU/s, ideal for dev/test', perfSpec: 'Max 400-1000 RU/s | No SLA' }
    },
    'autoscale-dev': {
      zh: { name: 'Autoscale Dev (开发弹性级)', desc: '单区域, 动态 400-4000 RU 自动缩放, 避开 429 限流', perfSpec: '弹性吞吐上限 4000 RU/s | 99.9% 可用性' },
      en: { name: 'Autoscale Dev', desc: 'Single region, dynamic 400-4000 RU autoscale to avoid 429 rate limit', perfSpec: 'Peak 4000 RU/s | 99.9% Availability' }
    },
    'enterprise-multi': {
      zh: { name: 'Enterprise Multi-Region (企业多活级)', desc: '多区域同步写入, 异地读写容灾', perfSpec: '双区域多写容灾 | 时延 <10ms | 99.999% SLA' },
      en: { name: 'Enterprise Multi-Region', desc: 'Multi-region active-active write synchronization with regional failover', perfSpec: 'Dual-region Multi-Write | Latency <10ms | 99.999% SLA' }
    }
  },
  apim: {
    none: {
      zh: { name: 'No Gateway (无网关)', desc: '直连后端服务, 无流量拦截审计与反爬虫', perfSpec: '直接暴露 ACA 端点' },
      en: { name: 'No Gateway', desc: 'Direct routing to backends, bypassing auditing, rate limits, or WAF rules', perfSpec: 'Exposed ACA Endpoint' }
    },
    developer: {
      zh: { name: 'APIM Developer (开发者级)', desc: '全量网关特性, 支持 JWT、限流、Mock与追踪。冷启动稍慢', perfSpec: '单实例 | 无 SLA 保证' },
      en: { name: 'APIM Developer', desc: 'Full gateway features including JWT, rate limits, mock responses, and tracing. Slower cold start', perfSpec: 'Single Instance | No SLA' }
    },
    premium: {
      zh: { name: 'APIM Premium (企业级多活)', desc: '多区域物理网关, 极低时延与企业级高可用性', perfSpec: '多活实例 | 99.99% 可用性' },
      en: { name: 'APIM Premium', desc: 'Multi-region physical gateways for ultra-low latency and enterprise HA', perfSpec: 'Multi-Active Instances | 99.99% SLA' }
    }
  },
  frontDoor: {
    none: {
      zh: { name: 'Direct Routing (直连网段)', desc: '不经过全球 CDN 节点, 直连 APIM/SWA 公网端点', perfSpec: '边缘无加速与 WAF' },
      en: { name: 'Direct Routing', desc: 'Bypasses global CDN nodes, routing traffic directly to APIM or SWA endpoints', perfSpec: 'No Edge Acceleration or WAF' }
    },
    standard: {
      zh: { name: 'Front Door Standard (标准加速版)', desc: '全球 118+ POP 节点 CDN 加速与 SSL 卸载', perfSpec: '静态内容边缘加速' },
      en: { name: 'Front Door Standard', desc: 'CDN acceleration and SSL offloading across 118+ global POP edge nodes', perfSpec: 'Edge-cached Content Acceleration' }
    },
    premium: {
      zh: { name: 'Front Door Premium (安全防护版)', desc: '自带企业级 WAF 防御规则与 Private Link 源站连接', perfSpec: 'OWASP Top 10 防护 + 私密源站连接' },
      en: { name: 'Front Door Premium', desc: 'Pre-bundled with enterprise WAF rule-sets and Private Link backend integration', perfSpec: 'OWASP Top 10 + Private Endpoint Backends' }
    }
  },
  aca: {
    'dev-sleep': {
      zh: { name: 'Dev Sleep (开发配额版)', desc: 'ACA 最低 0 副本, 闲置冷缩容, 运行规格 0.5 CPU / 1.0 GiB', perfSpec: '存在 cold-start 冷启动延迟' },
      en: { name: 'Dev Sleep', desc: 'ACA scales down to 0 replicas when idle, compute sizing 0.5 CPU / 1.0 GiB', perfSpec: 'Includes cold-start latency' }
    },
    'always-on': {
      zh: { name: 'Always On (常驻运行)', desc: '最低 1 副本常驻, 规格 0.5 CPU / 1.0 GiB, 适合生产API', perfSpec: '无延迟即时响应' },
      en: { name: 'Always On', desc: 'Minimum 1 replica always-on, compute sizing 0.5 CPU / 1.0 GiB for production APIs', perfSpec: 'Instant response time' }
    },
    'high-perf': {
      zh: { name: 'High Perf (高配常驻版)', desc: '最低 2 副本负载均衡, 规格 1.0 CPU / 2.0 GiB', perfSpec: '自动横向扩容' },
      en: { name: 'High Perf', desc: 'Minimum 2 replicas balanced, compute sizing 1.0 CPU / 2.0 GiB', perfSpec: 'Horizontal Autoscale' }
    }
  },
  redis: {
    none: {
      zh: { name: 'No Cache (无会话缓存)', desc: '不部署 Redis，使用内存态会话，不支持多节点状态同步', perfSpec: '无缓存' },
      en: { name: 'No Cache', desc: 'No Redis cache. Stores sessions in-memory. Cross-node synchronization disabled', perfSpec: 'No caching layer' }
    },
    'basic-c0': {
      zh: { name: 'Redis Basic C0 (微型缓存)', desc: '250 MB 内存, 单实例, 适合开发调试会话同步', perfSpec: '单节点无持久化' },
      en: { name: 'Redis Basic C0', desc: '250 MB memory, single instance, ideal for dev environment session sync', perfSpec: 'Single Node | No persistence' }
    },
    'standard-c1': {
      zh: { name: 'Redis Standard C1 (双机高可用)', desc: '1 GB 内存, 主从复制双机热备, SLA 99.9%', perfSpec: '主从热备自动容灾' },
      en: { name: 'Redis Standard C1', desc: '1 GB memory, primary-secondary replication, SLA 99.9%', perfSpec: 'Active-passive automatic failover' }
    }
  },
  search: {
    none: {
      zh: { name: 'No Search DB (无向量检索)', desc: '使用 Cosmos 内存模糊匹配, 不支持高维度语义向量检索', perfSpec: '不支持 RAG' },
      en: { name: 'No Search DB', desc: 'Uses database fuzzy string matching. High-dimensional vector search disabled', perfSpec: 'RAG unsupported' }
    },
    free: {
      zh: { name: 'AI Search Free (免费版)', desc: '免费 3 索引, 50MB 存储空间, 支持基本分词与混合检索', perfSpec: '支持简单 RAG | 无 SLA' },
      en: { name: 'AI Search Free', desc: 'Free 3 indices, 50MB storage. Supports base tokenization and hybrid search', perfSpec: 'Basic RAG supported | No SLA' }
    },
    basic: {
      zh: { name: 'AI Search Basic (向量专用版)', desc: '支持 2GB 向量索引, 高吞吐混合搜索与语义排序', perfSpec: '生产级语义搜索 | 99.9% SLA' },
      en: { name: 'AI Search Basic', desc: 'Supports 2GB vector indices, high-throughput hybrid search, and semantic ranking', perfSpec: 'Production-ready semantic search | 99.9% SLA' }
    }
  },
  iotHub: {
    'free-f1': {
      zh: { name: 'IoT Hub Free F1 (免费版)', desc: '每日免费 8,000 遥测消息, 允许连接最多 10 台设备', perfSpec: '适合原型开发验证' },
      en: { name: 'IoT Hub Free F1', desc: 'Free 8,000 telemetry messages/day. Up to 10 devices registered', perfSpec: 'Proto dev validation' }
    },
    'standard-s1': {
      zh: { name: 'IoT Hub Standard S1 (标准版)', desc: '每日 400,000 消息配额, 支持无限设备连接与设备双向孪生', perfSpec: '生产级大规模接入' },
      en: { name: 'IoT Hub Standard S1', desc: '400,000 messages/day quota. Supports unlimited devices and bidirectional twin', perfSpec: 'Production scale ingestion' }
    },
    'standard-s2': {
      zh: { name: 'IoT Hub Standard S2 (高吞吐版)', desc: '每日 6,000,000 消息吞吐, 适合大型车联网集群', perfSpec: '超大规模遥测吞吐' },
      en: { name: 'IoT Hub Standard S2', desc: '6,000,000 messages/day throughput. Designed for heavy automotive V2X telematics', perfSpec: 'High scale ingestion' }
    }
  }
};

export const SkuTuningSection: React.FC<SkuTuningSectionProps> = ({
  selectedSkus,
  onSelectSku,
  skuData,
  activeScenario
}) => {
  const { t, locale } = useI18n();

  const labelMap: Record<string, string> = locale === 'zh' ? {
    cosmosDb: '持久化数据层 (Azure Cosmos DB)',
    apim: 'API 管理网关 (API Management)',
    frontDoor: '全球边缘边界 (Azure Front Door)',
    aca: '计算容器平台 (Container Apps)',
    redis: '会话缓存层 (Azure Cache for Redis)',
    search: '全文向量检索 (Azure AI Search)',
    iotHub: '神经丛入口 (IoT Hub)'
  } : {
    cosmosDb: 'Persistent Data Layer (Azure Cosmos DB)',
    apim: 'API Gateway (API Management)',
    frontDoor: 'Global Edge Envelope (Azure Front Door)',
    aca: 'Compute Container Platform (Container Apps)',
    redis: 'Session Caching Layer (Azure Cache for Redis)',
    search: 'AI Vector Search (Azure AI Search)',
    iotHub: 'Ingestion Gate (IoT Hub)'
  };

  return (
    <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative">
      <h2 className="text-xs font-bold font-mono text-slate-400 mb-6 flex items-center justify-between border-b border-slate-900 pb-2 uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-cyan-400" />
          <span>{t('configurator.sec_sku')}</span>
        </div>
        {activeScenario !== 'custom' && (
          <span className="text-xs font-mono text-slate-400 tracking-wider bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {locale === 'zh' ? '当前预设' : 'Preset'}: {activeScenario}
          </span>
        )}
      </h2>

      <div className="flex flex-col gap-6">
        {Object.entries(skuData).map(([resType, options]) => {
          const currentSelection = selectedSkus[resType];

          return (
            <div key={resType} className="border-b border-slate-900/60 pb-5 last:border-b-0 last:pb-0">
              <h3 className="text-xs font-bold font-mono text-cyan-400 mb-3">{labelMap[resType]}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {options.map((opt) => {
                  const isSelected = currentSelection === opt.id;
                  const localizedOpt = SKU_LOCALIZED_DATA[resType]?.[opt.id]?.[locale] || {
                    name: opt.name,
                    desc: opt.desc,
                    perfSpec: opt.perfSpec
                  };

                  return (
                    <button
                      key={opt.id}
                      onClick={() => onSelectSku(resType, opt.id)}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 ${
                        isSelected 
                          ? 'bg-cyan-950/20 border-cyan-500/80 shadow-[0_0_15px_rgba(0,242,254,0.03)]' 
                          : 'bg-slate-950/40 border-slate-900 hover:border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[11px] font-bold font-mono ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>
                          {localizedOpt.name}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded">
                          {opt.monthlyCost === 0 ? (locale === 'zh' ? '免费' : 'Free') : (locale === 'zh' ? `$${opt.monthlyCost}/月` : `$${opt.monthlyCost}/mo`)}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed mt-2 text-slate-400 min-h-10 font-sans">
                        {localizedOpt.desc}
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-slate-900/60 text-xs font-mono text-slate-300 bg-[#060b13] p-1.5 rounded w-full">
                        🔒 <b>{locale === 'zh' ? '性能标的:' : 'Perf Target:'}</b> {localizedOpt.perfSpec}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
