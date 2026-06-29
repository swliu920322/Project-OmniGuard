'use client';

import React from 'react';
import { TrendingUp, PieChart } from 'lucide-react';
import { HotTopic, IndustryProportion, getCleanPercentage } from './types';

interface AnalysisChartsProps {
  hotTopics: HotTopic[];
  industries: IndustryProportion[];
}

const CHART_COLORS = [
  { stroke: 'stroke-cyan-400', text: 'text-cyan-400', bg: 'bg-cyan-500/20', barBg: 'bg-cyan-400' },
  { stroke: 'stroke-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/20', barBg: 'bg-emerald-400' },
  { stroke: 'stroke-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/20', barBg: 'bg-amber-400' },
  { stroke: 'stroke-fuchsia-400', text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20', barBg: 'bg-fuchsia-400' },
  { stroke: 'stroke-violet-400', text: 'text-violet-400', bg: 'bg-violet-500/20', barBg: 'bg-violet-400' }
];

export const AnalysisCharts: React.FC<AnalysisChartsProps> = ({ hotTopics, industries }) => {
  
  const renderDonutChart = (data: IndustryProportion[]) => {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={radius}
              className="stroke-slate-800 fill-none"
              strokeWidth="10"
            />
            {data.map((ind, i) => {
              const share = (ind.value / total) * circumference;
              const dashArray = `${share} ${circumference - share}`;
              const dashOffset = -accumulatedOffset;
              accumulatedOffset += share;

              const color = CHART_COLORS[i % CHART_COLORS.length];

              return (
                <circle
                  key={i}
                  cx="60"
                  cy="60"
                  r={radius}
                  className={`fill-none ${color.stroke} transition-all duration-500 hover:stroke-[12px] cursor-pointer`}
                  strokeWidth="10"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-slate-500 tracking-wider font-mono">SECTOR</span>
            <span className="text-sm font-black text-white mt-0.5">行业占比</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {data.map((ind, i) => {
            const color = CHART_COLORS[i % CHART_COLORS.length];
            return (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className={`w-3 h-3 rounded-full ${color.bg} border ${color.stroke.replace('stroke', 'border')} shrink-0`} />
                <span className="text-slate-400 font-medium">{ind.name}</span>
                <span className={`font-mono font-bold ml-auto ${color.text}`}>{ind.value}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Hot Topics */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full filter blur-[50px] pointer-events-none" />
        <h3 className="text-base font-extrabold text-white flex items-center gap-2">
          <TrendingUp size={16} className="text-[#00f2fe]" />
          推文热门话题热度排行 (Hot Topics)
        </h3>
        <div className="space-y-4">
          {hotTopics.map((topic, i) => {
            const color = CHART_COLORS[i % CHART_COLORS.length];
            const displayPct = getCleanPercentage(topic.percentage);
            return (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{topic.topic}</span>
                  <span className="text-slate-500 font-mono">
                    {topic.count}次提及 ({displayPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800/80 overflow-hidden">
                  <div
                    className={`h-full ${color.barBg} rounded-full transition-all duration-700`}
                    style={{ width: `${displayPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Industry Proportions */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full filter blur-[50px] pointer-events-none" />
        <h3 className="text-base font-extrabold text-white flex items-center gap-2">
          <PieChart size={16} className="text-emerald-400" />
          提及行业版块占比 (Industry Distribution)
        </h3>
        {renderDonutChart(industries)}
      </div>
    </div>
  );
};
