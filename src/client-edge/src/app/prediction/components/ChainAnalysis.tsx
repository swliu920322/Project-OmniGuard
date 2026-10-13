'use client';

import React from 'react';
import { ShieldAlert, Database, ArrowRight } from 'lucide-react';
import { BottleneckItem, MappingNode } from './types';

interface ChainAnalysisProps {
  bottlenecks: BottleneckItem[];
  valueChain: MappingNode[];
}

function getTightness(t?: number) {
  const v = t ?? 0;
  if (v >= 8) return { label: '严重紧缺', color: 'text-rose-400', border: 'border-rose-500/30', bar: 'bg-rose-500' };
  if (v >= 6) return { label: '偏紧', color: 'text-amber-400', border: 'border-amber-500/30', bar: 'bg-amber-500' };
  if (v >= 4) return { label: '均衡', color: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-500' };
  return { label: '宽松/过剩', color: 'text-slate-400', border: 'border-slate-700', bar: 'bg-slate-600' };
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
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-500" />
              供应链卡脖子/缺货跟踪 (Bottlenecks)
            </h3>
            <p className="text-[10px] font-mono text-slate-500">
              紧缺度 0-10：≥8 严重紧缺 / 6-7 偏紧 / 4-5 均衡 / ≤3 宽松；受益=涨价传导方，受损=成本承压方
            </p>
          </div>
          <div className="space-y-4">
            {bottlenecks.map((item, i) => {
              const t = getTightness(item.tightness);
              const bens = item.beneficiaries ?? [];
              const imps = item.impacted ?? [];
              return (
                <div key={i} className="rounded-2xl border border-amber-550/10 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="shrink-0 text-amber-500" size={16} />
                      <span className="text-xs font-bold text-amber-200">{item.category}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${t.color} ${t.border}`}>
                      {item.tightness ?? 0}/10 · {t.label}
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800/60">
                    <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${(item.tightness ?? 0) * 10}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {item.status}
                  </p>
                  <div className="text-[9px] font-mono text-slate-500">
                    影响标的: {Array.isArray(item.affected_tickers) ? item.affected_tickers.join(', ') : item.affected_tickers}
                  </div>
                  {(bens.length > 0 || imps.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 text-[9px] font-mono">
                      {bens.map((b, bi) => (
                        <span key={bi} className="px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">受益 {b}</span>
                      ))}
                      {imps.map((b, bi) => (
                        <span key={bi} className="px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-400">受损 {b}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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