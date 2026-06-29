'use client';

import React from 'react';
import { ShieldAlert, Database, ArrowRight } from 'lucide-react';
import { BottleneckItem, MappingNode } from './types';

interface ChainAnalysisProps {
  bottlenecks: BottleneckItem[];
  valueChain: MappingNode[];
}

export const ChainAnalysis: React.FC<ChainAnalysisProps> = ({ bottlenecks, valueChain }) => {
  const hasBottlenecks = bottlenecks && bottlenecks.length > 0;
  const hasValueChain = valueChain && valueChain.length > 0;

  if (!hasBottlenecks && !hasValueChain) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Supply Chain Bottlenecks */}
      {hasBottlenecks && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-md">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-500" />
            供应链卡脖子/缺货跟踪 (Bottlenecks)
          </h3>
          <div className="space-y-4">
            {bottlenecks.map((item, i) => (
              <div key={i} className="rounded-2xl border border-amber-550/10 bg-amber-500/5 p-4 space-y-2 flex items-start gap-3">
                <ShieldAlert className="shrink-0 mt-1 text-amber-500" size={16} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-200">{item.category}</span>
                    <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20">
                      影响标的: {Array.isArray(item.affected_tickers) ? item.affected_tickers.join(', ') : item.affected_tickers}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    {item.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Value Chain Mapping */}
      {hasValueChain && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-md">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Database size={16} className="text-[#00f2fe]" />
            产业链节点图谱映射 (Value Chain Nodes)
          </h3>
          <div className="space-y-4">
            {valueChain.map((node, i) => (
              <div key={i} className="rounded-2xl border border-slate-800 bg-slate-955/40 p-4 space-y-3">
                <div className="text-[10px] font-mono text-slate-500">映射路径 #{i+1}</div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Upstream */}
                  <div className="flex flex-col gap-0.5 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 min-w-[120px] max-w-[180px] cursor-help" title={node.upstream}>
                    <span className="text-[9px] font-mono text-slate-500">上游组件 (Upstream)</span>
                    <span className="text-xs font-bold text-white truncate">{node.upstream}</span>
                  </div>
                  <ArrowRight className="text-slate-650 hidden sm:block shrink-0" size={12} />
                  {/* Midstream */}
                  <div className="flex flex-col gap-0.5 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 min-w-[120px] max-w-[180px] cursor-help" title={node.midstream}>
                    <span className="text-[9px] font-mono text-slate-500">中游系统 (Midstream)</span>
                    <span className="text-xs font-bold text-[#00f2fe] truncate">{node.midstream}</span>
                  </div>
                  <ArrowRight className="text-slate-650 hidden sm:block shrink-0" size={12} />
                  {/* Downstream */}
                  <div className="flex flex-col gap-0.5 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 min-w-[120px] max-w-[180px] cursor-help" title={node.downstream}>
                    <span className="text-[9px] font-mono text-slate-500">下游客户 (Downstream)</span>
                    <span className="text-xs font-bold text-emerald-400 truncate">{node.downstream}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
