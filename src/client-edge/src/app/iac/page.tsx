'use client';

import React from 'react';
import Link from 'next/link';
import { LayoutGrid, ArrowUpRight, ShieldCheck, Cpu, HardDrive, Terminal } from 'lucide-react';
import { BICEP_ARCH_PRESETS } from '@/config/bicepPresets';

export default function IaCPlatformHubPage() {
  const iconMap: Record<string, React.ReactNode> = {
    'enterprise-landing-zone': <ShieldCheck className="text-cyan-400 size-6" />,
    'insightflow-production': <HardDrive className="text-amber-400 size-6" />
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-8 md:p-16 select-none">

      <div className="max-w-6xl mx-auto mb-12 border-b border-slate-900 pb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-1 flex items-center gap-1">
            <Terminal size={12} /> ENTERPRISE_ASSET_REPOSITORY
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            云原生 IaC 高阶方案矩阵大厅
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1 leading-relaxed">
            点击任意多文件 Landing Zone 方案，进入嵌套子路由控制台，秒级调用隐式符号对账引擎。
          </p>
        </div>
        {/* 🎯 刚性校准：空白沙盘指针直接指向子路由 */}
        <Link href="/iac/canvas" className="text-xs font-mono border border-slate-800 bg-slate-900 hover:border-cyan-500 px-4 py-2 rounded-lg text-slate-300 transition-all shadow-xl">
          直接开辟空白沙盘 ➔
        </Link>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(BICEP_ARCH_PRESETS).map(([key, preset]) => (
          <div
            key={key}
            className="group bg-[#0d1321]/40 border border-slate-900 hover:border-cyan-500/40 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-2xl hover:shadow-[0_0_30px_rgba(0,242,254,0.03)]"
          >
            <div className="h-40 bg-gradient-to-br from-slate-900 to-[#060912] relative flex items-center justify-center border-b border-slate-900/60 overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_24px] opacity-10"></div>
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-2xl group-hover:scale-110 transition-transform duration-300">
                {iconMap[key] || <LayoutGrid className="text-slate-500" />}
              </div>
              <div className="absolute bottom-2 left-3 text-[9px] font-mono text-slate-600 uppercase tracking-widest">
                PRESET_KEY: {key}
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-200 group-hover:text-cyan-400 transition-colors leading-snug">
                  {preset.name}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-2 line-clamp-3">
                  {preset.description}
                </p>
              </div>

              {/* 🎯 刚性校准：流控弹射网桥完全并轨到 /iac/canvas */}
              <Link
                href={`/iac/canvas/?preset=${key}`}
                className="w-full py-2 bg-slate-950 hover:bg-cyan-500 border border-slate-900 text-slate-400 hover:text-slate-950 font-mono font-bold text-center text-xs rounded-xl flex items-center justify-center gap-1 transition-all duration-200 shadow-md"
              >
                <span>解密并审计该多文件架构</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}