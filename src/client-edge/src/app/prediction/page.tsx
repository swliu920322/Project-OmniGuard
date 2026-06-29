'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Cpu,
  Database,
  Globe,
  Languages,
  PieChart,
  RefreshCw,
  Terminal,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  ChevronDown
} from 'lucide-react';

interface TweetItem {
  original: string;
  translation: string;
}

interface DailyTweets {
  date: string;
  tweets: TweetItem[];
}

interface HotTopic {
  topic: string;
  count: number;
  percentage: number;
}

interface IndustryProportion {
  name: string;
  value: number;
}

interface ConvictionStock {
  ticker: string;
  conviction_level: string;
  mention_count: number;
  investment_thesis: string;
}

interface BottleneckItem {
  category: string;
  status: string;
  affected_tickers: string;
}

interface MappingNode {
  upstream: string;
  midstream: string;
  downstream: string;
}

interface ReportData {
  user_id: string;
  range_days: number;
  last_updated: string;
  hot_topics: HotTopic[];
  industries: IndustryProportion[];
  conviction_watchlist: ConvictionStock[];
  supply_chain_bottlenecks: BottleneckItem[];
  value_chain_mapping: MappingNode[];
  data: DailyTweets[];
}

interface Kol {
  id: string;
  name: string;
}

export default function PredictionPage() {
  const [kols, setKols] = useState<Kol[]>([
    { id: '1940360837547565056', name: 'Aleabitoreddit (默认标的)' }
  ]);
  const [selectedKolId, setSelectedKolId] = useState<string>('1940360837547565056');
  const [report, setReport] = useState<ReportData | null>(null);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load KOL list and report on mount/KOL change
  useEffect(() => {
    fetchKols();
    fetchReport(selectedKolId);
  }, [selectedKolId]);

  const fetchKols = async () => {
    try {
      const res = await fetch('/api/kol/list');
      if (res.ok) {
        const data = await res.json();
        setKols(data);
      }
    } catch (e) {
      console.log('Failed to fetch KOL list, using default', e);
    }
  };

  const fetchReport = async (kolId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/kol/report?target_user_id=${kolId}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        const errData = await res.json();
        setReport(null);
        setError(errData.message || '该大 V 暂无抓取对比数据。');
      }
    } catch (e) {
      setReport(null);
      setError('无法连接到后端服务，请确认后端 API 正在运行。');
    } finally {
      setLoading(false);
    }
  };

  // Color palette for charts
  const chartColors = [
    { stroke: 'stroke-cyan-400', text: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { stroke: 'stroke-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { stroke: 'stroke-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/20' },
    { stroke: 'stroke-fuchsia-400', text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20' },
    { stroke: 'stroke-violet-400', text: 'text-violet-400', bg: 'bg-violet-500/20' }
  ];

  const getConvictionStyles = (level: string) => {
    if (level.includes('重仓') || level.includes('Core')) {
      return 'border-rose-500/35 bg-rose-500/10 text-rose-450'; // Core/Heavy
    }
    if (level.includes('买入') || level.includes('Starter')) {
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400'; // Starter
    }
    return 'border-slate-700 bg-slate-805/50 text-slate-400';
  };

  // Render donut chart programmatically
  const renderDonutChart = (industries: IndustryProportion[]) => {
    const total = industries.reduce((acc, curr) => acc + curr.value, 0);
    const radius = 50;
    const circumference = 2 * Math.PI * radius; // ~314.16
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
            {industries.map((ind, i) => {
              const share = (ind.value / total) * circumference;
              const dashArray = `${share} ${circumference - share}`;
              const dashOffset = -accumulatedOffset;
              accumulatedOffset += share;

              const color = chartColors[i % chartColors.length];

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
          {industries.map((ind, i) => {
            const color = chartColors[i % chartColors.length];
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
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
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
              <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-500 font-mono pl-2">监控目标:</span>
                <div className="relative">
                  <select
                    value={selectedKolId}
                    onChange={(e) => setSelectedKolId(e.target.value)}
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

              {report && (
                <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-500 font-mono pl-2">导出 PDF:</span>
                  <button
                    onClick={() => window.open(`http://localhost:7071/api/kol/pdf?target_user_id=${selectedKolId}&range_days=7`)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-[#00f2fe] text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    近 7 天
                  </button>
                  <button
                    onClick={() => window.open(`http://localhost:7071/api/kol/pdf?target_user_id=${selectedKolId}&range_days=15`)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-[#00f2fe] text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    近 15 天
                  </button>
                </div>
              )}

              <button
                onClick={() => fetchReport(selectedKolId)}
                disabled={loading}
                className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-[#00f2fe] hover:text-white text-slate-400 transition-all active:scale-[0.97]"
                title="刷新缓存数据"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-[#00f2fe]' : ''} />
              </button>
            </div>
          </div>
        </section>

        {/* Loading state */}
        {loading && !report && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/20 p-20 text-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-[#00f2fe] mx-auto" />
            <p className="text-xs text-slate-500">正在载入最新数据对照账本...</p>
          </div>
        )}

        {/* Main report presentation */}
        {report ? (
          <div className="space-y-6">
            
            {/* Visual Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hot Topics (Bar Charts) */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full filter blur-[50px] pointer-events-none" />
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#00f2fe]" />
                  推文热门话题热度排行 (Hot Topics)
                </h3>
                <div className="space-y-4">
                  {report.hot_topics.map((topic, i) => {
                    const color = chartColors[i % chartColors.length];
                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200">{topic.topic}</span>
                          <span className="text-slate-500 font-mono">
                            {topic.count}次提及 ({topic.percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800/80 overflow-hidden">
                          <div
                            className={`h-full ${color.bg.replace('/20', '')} rounded-full transition-all duration-700`}
                            style={{ width: `${topic.percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Industry Proportions (Donut Chart) */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full filter blur-[50px] pointer-events-none" />
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <PieChart size={16} className="text-emerald-400" />
                  提及行业版块占比 (Industry Distribution)
                </h3>
                {renderDonutChart(report.industries)}
              </div>
            </div>

            {/* Conviction Watchlist */}
            {report.conviction_watchlist && report.conviction_watchlist.length > 0 && (
              <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-lg">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#00f2fe]" />
                  博主核心关注标的信心指数 (Conviction Watchlist)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {report.conviction_watchlist.map((stock, i) => (
                    <div key={i} className="rounded-2xl border border-slate-800 bg-slate-955/50 p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-black text-white font-mono">{stock.ticker}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${getConvictionStyles(stock.conviction_level)}`}>
                          {stock.conviction_level}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed leading-5">
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
            )}

            {/* Supply Chain Bottlenecks & Value Chain Mapping Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Supply Chain Bottlenecks */}
              {report.supply_chain_bottlenecks && report.supply_chain_bottlenecks.length > 0 && (
                <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-md">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <ShieldAlert size={16} className="text-amber-500" />
                    供应链卡脖子/缺货跟踪 (Bottlenecks)
                  </h3>
                  <div className="space-y-4">
                    {report.supply_chain_bottlenecks.map((item, i) => (
                      <div key={i} className="rounded-2xl border border-amber-550/10 bg-amber-500/5 p-4 space-y-2 flex items-start gap-3">
                        <ShieldAlert className="shrink-0 mt-1 text-amber-500" size={16} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-200">{item.category}</span>
                            <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20">影响标的: {Array.isArray(item.affected_tickers) ? item.affected_tickers.join(', ') : item.affected_tickers}</span>
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
              {report.value_chain_mapping && report.value_chain_mapping.length > 0 && (
                <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 space-y-6 shadow-md">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Database size={16} className="text-[#00f2fe]" />
                    产业链节点图谱映射 (Value Chain Nodes)
                  </h3>
                  <div className="space-y-4">
                    {report.value_chain_mapping.map((node, i) => (
                      <div key={i} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                        <div className="text-[10px] font-mono text-slate-500">映射路径 #{i+1}</div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          
                          {/* Upstream */}
                          <div
                            className="flex flex-col gap-0.5 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 min-w-[120px] max-w-[180px] hover:max-w-none transition-all duration-200 group/node cursor-help"
                            title={node.upstream}
                          >
                            <span className="text-[9px] font-mono text-slate-500">上游组件 (Upstream)</span>
                            <span className="text-xs font-bold text-white truncate group-hover/node:whitespace-normal group-hover/node:break-all">{node.upstream}</span>
                          </div>

                          <ArrowRight className="text-slate-650 hidden sm:block shrink-0" size={12} />

                          {/* Midstream */}
                          <div
                            className="flex flex-col gap-0.5 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 min-w-[120px] max-w-[180px] hover:max-w-none transition-all duration-200 group/node cursor-help"
                            title={node.midstream}
                          >
                            <span className="text-[9px] font-mono text-slate-500">中游系统 (Midstream)</span>
                            <span className="text-xs font-bold text-[#00f2fe] truncate group-hover/node:whitespace-normal group-hover/node:break-all">{node.midstream}</span>
                          </div>

                          <ArrowRight className="text-slate-650 hidden sm:block shrink-0" size={12} />

                          {/* Downstream */}
                          <div
                            className="flex flex-col gap-0.5 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 min-w-[120px] max-w-[180px] hover:max-w-none transition-all duration-200 group/node cursor-help"
                            title={node.downstream}
                          >
                            <span className="text-[9px] font-mono text-slate-500">下游客户 (Downstream)</span>
                            <span className="text-xs font-bold text-emerald-400 truncate group-hover/node:whitespace-normal group-hover/node:break-all">{node.downstream}</span>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Metadata Status Card */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="text-[#00f2fe]" size={20} />
                <div>
                  <h4 className="font-bold text-white text-sm">中英对照推文列表</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    展示最近 <span className="text-[#00f2fe] font-mono font-bold">{report.range_days}</span> 天内推文。数据源更新时间: <span className="font-mono text-slate-300">{report.last_updated}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <Database size={12} className="text-[#00f2fe]" /> 本地缓存文件: report_translated_{selectedKolId}.json
              </div>
            </div>

            {/* Daily grouped bilingual tweets */}
            <div className="space-y-8">
              {report.data.map((dayGroup, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-4 bg-[#00f2fe] rounded-full" />
                    <h3 className="text-lg font-extrabold text-white font-mono">
                      {dayGroup.date}
                    </h3>
                    <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                      共 {dayGroup.tweets.length} 条内容
                    </span>
                  </div>

                  <div className="space-y-4">
                    {dayGroup.tweets.map((tweet, tIdx) => (
                      <div
                        key={tIdx}
                        className="rounded-3xl border border-slate-800 bg-slate-900/10 hover:border-slate-700/60 p-6 shadow-md transition-all duration-300 group"
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          
                          {/* English Original */}
                          <div className="space-y-2 border-r border-slate-800/0 lg:border-r lg:border-slate-800/80 pr-0 lg:pr-6">
                            <div className="flex items-center gap-2 text-[10px] tracking-wider uppercase text-slate-500 font-mono font-bold">
                              <Globe size={12} className="text-[#00f2fe]" />
                              Original English Post
                            </div>
                            <p className="text-sm text-slate-200 leading-relaxed max-w-none break-words whitespace-pre-wrap font-sans">
                              {tweet.original}
                            </p>
                          </div>

                          {/* Chinese Translation */}
                          <div className="space-y-2 lg:pl-0">
                            <div className="flex items-center gap-2 text-[10px] tracking-wider uppercase text-slate-500 font-mono font-bold">
                              <Languages size={12} className="text-emerald-400" />
                              Bilingual Translation (中文对照)
                            </div>
                            <p className="text-sm text-emerald-300/90 leading-relaxed max-w-none break-words whitespace-pre-wrap font-sans">
                              {tweet.translation}
                            </p>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </div>
        ) : (
          !loading && (
            <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/10 p-12 text-center text-slate-500 space-y-6">
              <Terminal size={48} className="mx-auto text-slate-700 animate-pulse" />
              <div className="max-w-md mx-auto space-y-2">
                <h4 className="font-bold text-slate-400">数据对照缓存文件未找到</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  请先在后端运行数据更新脚本来爬取及翻译大V数据。运行完毕后，点击右上角的“刷新”按钮。
                </p>
              </div>
              <div className="inline-block rounded-2xl bg-slate-950 p-4 border border-slate-800/60 font-mono text-[10px] text-left text-slate-400 space-y-1">
                <div><span className="text-[#00f2fe]"># 1. 进入后端项目</span></div>
                <div>cd src/cloud-orchestrator</div>
                <div><span className="text-[#00f2fe]"># 2. 激活虚拟环境</span></div>
                <div>source .venv/bin/activate</div>
                <div><span className="text-[#00f2fe]"># 3. 运行翻页采集并让 AI 翻译与归纳</span></div>
                <div>python run_analysis.py</div>
              </div>
            </div>
          )
        )}

      </div>
    </main>
  );
}
