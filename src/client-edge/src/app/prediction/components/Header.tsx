'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Cpu, ChevronDown, RefreshCw } from 'lucide-react';
import { Kol } from './types';

interface HeaderProps {
  kols: Kol[];
  selectedKolId: string;
  onKolChange: (id: string) => void;
  timeFilter: string;
  onTimeFilterChange: (val: string) => void;
  onRefresh: () => void;
  loading: boolean;
  hasReport: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  kols,
  selectedKolId,
  onKolChange,
  timeFilter,
  onTimeFilterChange,
  onRefresh,
  loading,
  hasReport
}) => {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#00f2fe]/5 rounded-full filter blur-[80px] pointer-events-none" />
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#00f2fe] text-slate-400 hover:text-white transition-all">
              <ArrowLeft size={14} />
            </Link>
            <div className="text-[#00f2fe] text-xs uppercase tracking-[0.35em] font-mono flex items-center gap-2">
              <Cpu size={12} /> KOL_DECISION_BOARD
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mt-3">
            大 V 投资深度监控看板
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
            本模块整合了对大 V 推特时序数据的深度投研提炼。包含核心标的仓位信心、硬核产业链卡脖子分析及上中下游流动图谱，下方配有双语对照原文供您自主对账。
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* 监控目标大V */}
          <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-500 font-mono pl-2">监控目标:</span>
            <div className="relative">
              <select
                value={selectedKolId}
                onChange={(e) => onKolChange(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 pr-10 text-xs text-white focus:outline-none focus:border-[#00f2fe] cursor-pointer hover:border-slate-700 transition-colors"
              >
                {kols.map((kol) => (
                  <option key={kol.id} value={kol.id}>
                    {kol.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-2.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* 全局时间过滤器 */}
          <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-500 font-mono pl-2">时序窗口:</span>
            <div className="relative">
              <select
                value={timeFilter}
                onChange={(e) => onTimeFilterChange(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 pr-10 text-xs text-white focus:outline-none focus:border-[#00f2fe] cursor-pointer hover:border-slate-700 transition-colors"
              >
                <option value="7">近一周 (7天)</option>
                <option value="30">近一个月 (30天)</option>
                <option value="90">近三个月 (90天)</option>
                <option value="180">近半年 (180天)</option>
                <option value="365">近一年 (365天)</option>
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-2.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* PDF 导出 (直接根据所选时序窗口同步导出) */}
          {hasReport && (
            <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
              <button
                onClick={() => window.open(`http://localhost:7071/api/kol/pdf?target_user_id=${selectedKolId}&range_days=${timeFilter}`)}
                className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-[#00f2fe] text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                导出当前 PDF 报告
              </button>
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-[#00f2fe] hover:text-white text-slate-400 transition-all active:scale-[0.97]"
            title="刷新缓存数据"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#00f2fe]' : ''} />
          </button>
        </div>
      </div>
    </section>
  );
};
