'use client';

import React from 'react';
import { Calendar, Database, Globe, Languages } from 'lucide-react';
import { DailyTweets } from './types';

interface TweetTimelineProps {
  filteredTweets: DailyTweets[];
  selectedKolId: string;
  lastUpdated: string;
}

export const TweetTimeline: React.FC<TweetTimelineProps> = ({
  filteredTweets,
  selectedKolId,
  lastUpdated
}) => {
  return (
    <div className="space-y-6">
      {/* Metadata Status Card */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="text-[#00f2fe]" size={20} />
          <div>
            <h4 className="font-bold text-white text-sm">中英对照推文列表</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              数据源更新时间: <span className="font-mono text-slate-300">{lastUpdated}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          <Database size={12} className="text-[#00f2fe]" /> 本地缓存文件: report_translated_{selectedKolId}.json
        </div>
      </div>

      {/* Daily grouped bilingual tweets */}
      <div className="space-y-8">
        {filteredTweets.length > 0 ? (
          filteredTweets.map((dayGroup, idx) => (
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
          ))
        ) : (
          <div className="text-center py-12 text-slate-500 border border-slate-900 bg-slate-950/40 rounded-3xl">
            当前时序窗口范围内暂无已翻译的推文数据。
          </div>
        )}
      </div>
    </div>
  );
};
