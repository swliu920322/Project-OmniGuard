import React from 'react';
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

export const SkuTuningSection: React.FC<SkuTuningSectionProps> = ({
  selectedSkus,
  onSelectSku,
  skuData,
  activeScenario
}) => {
  const labelMap: Record<string, string> = {
    cosmosDb: '持久化数据层 (Azure Cosmos DB)',
    apim: 'API 管理网关 (API Management)',
    frontDoor: '全球边缘边界 (Azure Front Door)',
    aca: '计算容器平台 (Container Apps)',
    redis: '会话缓存层 (Azure Cache for Redis)',
    search: '全文向量检索 (Azure AI Search)',
    iotHub: '神经丛入口 (IoT Hub)'
  };

  return (
    <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative">
      <h2 className="text-xs font-bold font-mono text-slate-400 mb-6 flex items-center justify-between border-b border-slate-900 pb-2 uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-cyan-400" />
          <span>架构师精细微调规格 (Architect SKU Spec Tuning)</span>
        </div>
        {activeScenario !== 'custom' && (
          <span className="text-xs font-mono text-slate-400 tracking-wider bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            当前预设: {activeScenario}
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
                          {opt.name}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded">
                          {opt.monthlyCost === 0 ? '免费' : `$${opt.monthlyCost}/月`}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed mt-2 text-slate-400 min-h-10">
                        {opt.desc}
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-slate-900/60 text-xs font-mono text-slate-300 bg-[#060b13] p-1.5 rounded w-full">
                        🔒 <b>性能标的:</b> {opt.perfSpec}
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
