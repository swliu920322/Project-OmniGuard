'use client';

import React from 'react';
import Link from 'next/link';
import { LayoutGrid, ArrowUpRight, ShieldCheck, HardDrive, Terminal } from 'lucide-react';
import { BICEP_ARCH_PRESETS } from '@/config/bicepPresets';

export default function IaCPlatformHubPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-8 md:p-16 select-none animate-in fade-in duration-200">

      <div className="max-w-6xl mx-auto mb-12 border-b border-slate-900 pb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-1 flex items-center gap-1">
            <Terminal size={12} /> COMPILER_AUTO_SCAN_ACTIVE
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            云原生 IaC 全自动方案军火库
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1 leading-relaxed">
            硬核零代码维护！只需往 <code className="text-cyan-500 bg-slate-900 px-1 py-0.5 rounded">src/presets/</code> 扔进新 Bicep 文件夹，系统编译期自动识别并就地动态物化上架。
          </p>
        </div>
        <Link href="/iac/canvas" className="text-xs font-mono border border-slate-800 bg-slate-900 hover:border-cyan-500 px-4 py-2 rounded-lg text-slate-300 transition-all shadow-xl">
          开辟空白沙盘 ➔
        </Link>
      </div>

      {/* 方案网格流 */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(BICEP_ARCH_PRESETS).map(([key, preset]) => (
          <div
            key={key}
            className="group bg-[#0d1321]/40 border border-slate-900 hover:border-cyan-500/40 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-2xl hover:shadow-[0_0_30px_rgba(0,242,254,0.03)]"
          >

            {/* 🎯 封面全自动自愈控制视窗 */}
            <div className="h-40 relative flex items-center justify-center border-b border-slate-900/60 overflow-hidden bg-gradient-to-br from-slate-900 to-[#060912]">
              {preset.coverImg ? (
                // 🟩 A 轨：如果检测到封面存在，100% 满血加载图片真实场景
                <img
                  src={preset.coverImg}
                  alt={preset.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                // 🟩 B 轨：如果图片踩空 (无封面)，自动拉起默认的矩阵斑马线，零报错阻尼
                <>
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_24px] opacity-10"></div>
                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-2xl group-hover:scale-110 transition-transform duration-300">
                    {key.includes('rag') || key.includes('storage') ? <HardDrive className="text-amber-400 size-6" /> : <ShieldCheck className="text-cyan-400 size-6" />}
                  </div>
                </>
              )}

              <div className="absolute bottom-2 left-3 text-[9px] font-mono text-slate-600 uppercase tracking-widest bg-slate-950/40 px-1.5 py-0.5 rounded">
                DIR_NODE: {key}
              </div>
            </div>

            {/* 说明信息 */}
            <div className="p-5 flex-1 flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200 group-hover:text-cyan-400 transition-colors leading-snug font-mono">
                  {preset.name}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-2 line-clamp-3 font-sans">
                  {preset.description}
                </p>
              </div>

              <Link
                href={`/iac/canvas/?preset=${key}`}
                className="w-full py-2 bg-slate-950 hover:bg-cyan-500 border border-slate-900 text-slate-400 hover:text-slate-100 font-mono font-bold text-center text-xs rounded-xl flex items-center justify-center gap-1 transition-all duration-200 shadow-md"
              >
                <span>进入分布式拓扑审计</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>

          </div>
        ))}
      </div>
    </main>
  );
}