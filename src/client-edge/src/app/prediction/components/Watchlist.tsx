'use client';

import React from 'react';
import { TrendingUp, ArrowUp, ArrowDown, Minus, Sparkles } from 'lucide-react';
import { ConvictionStock } from './types';

interface WatchlistProps {
  watchlist: ConvictionStock[];
}

const TREND_META: Record<string, { icon: React.ReactNode; text: string; cls: string }> = {
  rising: { icon: <ArrowUp size={11} />, text: '加仓中', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  steady: { icon: <Minus size={11} />, text: '平台期', cls: 'text-slate-400 border-slate-700 bg-slate-900' },
  declining: { icon: <ArrowDown size={11} />, text: '减仓中', cls: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  new: { icon: <Sparkles size={11} />, text: '新提及', cls: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
};

const HORIZON_META: Record<string, { text: string; cls: string }> = {
  long: { text: '长期·结构性', cls: 'border-slate-700 text-slate-400' },
  mid: { text: '中期·景气', cls: 'border-slate-700 text-slate-400' },
  short: { text: '短期·事件', cls: 'border-slate-700 text-slate-400' },
};

export const Watchlist: React.FC<WatchlistProps> = ({ watchlist }) => {
  const getConvictionStyles = (level: string) => {
    if (level.includes('重仓') || level.includes('Core')) {
      return 'border-rose-500/35 bg-rose-500/10 text-rose-450';
    }
    if (level.includes('买入') || level.includes('Starter')) {
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400';
    }
    return 'border-slate-700 bg-slate-805/50 text-slate-400';
  };

  if (!watchlist || watchlist.length === 0) return null;

  // 按信心分降序，展示 Top 12（数据里可能包含大量低分提及标的，聚焦核心关注）
  const sorted = [...watchlist].sort((a, b) => (b.conviction_score ?? 0) - (a.conviction_score ?? 0));
  const visible = sorted.slice(0, 12);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-lg">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-extrabold text-white flex items-center gap-2">
          <TrendingUp size={16} className="text-[#00f2fe]" />
          博主核心关注标的信心指数 (Conviction Watchlist)
        </h3>
        <span className="text-[10px] font-mono text-slate-500">
          共 {watchlist.length} 个标的 · 按信心分排序 Top {visible.length}
        </span>
      </div>

      {/* 图例：让新人一眼看懂信心分 / 趋势 / 周期 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-[10px] font-mono text-slate-400 space-y-1.5 leading-relaxed">
        <div>
          <span className="text-slate-300 font-bold">信心分 (0-100)</span> = AI 话语强度（等级）×70% + 提及频次 ×15% + 跨天一致性 ×15%。等级由 AI 判定：核心重仓 / 首仓买入 / 中性观察；分数在等级基础上叠加本地统计，越高代表博主对标的越笃定。
        </div>
        <div>
          <span className="text-slate-300 font-bold">趋势</span> = 对比上一等长周期提及量：<span className="text-emerald-400">加仓中</span> / <span className="text-slate-400">平台期</span> / <span className="text-rose-400">减仓中</span> / <span className="text-cyan-400">新提及</span>。
        </div>
        <div>
          <span className="text-slate-300 font-bold">周期</span> = 论述性质：长期·结构性（产业链位置）/ 中期·景气（供需周期）/ 短期·事件（消息催化）。
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {visible.map((stock, i) => {
          const trend = TREND_META[stock.trend || 'new'] ?? TREND_META.new;
          const horizon = HORIZON_META[stock.horizon || 'mid'] ?? HORIZON_META.mid;
          const score = stock.conviction_score ?? 0;
          const scoreColor = score >= 80 ? 'text-rose-400' : score >= 60 ? 'text-emerald-400' : 'text-slate-400';
          const scoreBar = score >= 80 ? 'bg-rose-500' : score >= 60 ? 'bg-emerald-500' : 'bg-slate-600';
          return (
            <div key={i} className="rounded-2xl border border-slate-800 bg-slate-955/50 p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-black text-white font-mono">{stock.ticker}</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`text-xs font-mono font-bold ${scoreColor}`}>{score}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${getConvictionStyles(stock.conviction_level)}`}>
                      {stock.conviction_level}
                    </span>
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800/60">
                  <div className={`h-full rounded-full ${scoreBar}`} style={{ width: `${score}%` }} />
                </div>
                <p className="text-xs text-slate-400 leading-5">
                  {stock.investment_thesis}
                </p>
              </div>
              <div className="border-t border-slate-800/80 pt-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>时序提及</span>
                  <span className="font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {stock.mention_count} 次 · {stock.mention_days ?? 1} 天
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${trend.cls}`}>
                    {trend.icon} {trend.text}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded border ${horizon.cls}`}>
                    {horizon.text}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};