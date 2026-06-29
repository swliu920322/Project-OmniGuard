'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { ConvictionStock } from './types';

interface WatchlistProps {
  watchlist: ConvictionStock[];
}

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

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-lg">
      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
        <TrendingUp size={16} className="text-[#00f2fe]" />
        博主核心关注标的信心指数 (Conviction Watchlist)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {watchlist.map((stock, i) => (
          <div key={i} className="rounded-2xl border border-slate-800 bg-slate-955/50 p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-lg font-black text-white font-mono">{stock.ticker}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${getConvictionStyles(stock.conviction_level)}`}>
                {stock.conviction_level}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-5">
              {stock.investment_thesis}
            </p>
            <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>时序提及频率</span>
              <span className="font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{stock.mention_count} 次提及</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
