import React from 'react';
import { Coins, Gauge, Save, Cloud, Download } from 'lucide-react';

interface CostCalculatorPanelProps {
  monthlyTotal: number;
  dailyTotal: number;
  perfRating: { grade: string; color: string; desc: string };
  isSaving: boolean;
  isValidatingCloud: boolean;
  saveMessage: { type: 'success' | 'error'; text: string } | null;
  onSaveConfig: () => void;
  onPreflightValidate: () => Promise<void>;
  onDownloadPackage: () => void;
}

export const CostCalculatorPanel: React.FC<CostCalculatorPanelProps> = ({
  monthlyTotal,
  dailyTotal,
  perfRating,
  isSaving,
  isValidatingCloud,
  saveMessage,
  onSaveConfig,
  onPreflightValidate,
  onDownloadPackage
}) => {
  return (
    <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative flex flex-col gap-5">
      <h2 className="text-xs font-bold font-mono text-slate-400 border-b border-slate-900 pb-2 flex items-center gap-2 uppercase tracking-wider font-sans">
        <Coins size={15} className="text-cyan-400" />
        <span>03. 拓扑估算与架构评级</span>
      </h2>

      {/* Calculations display */}
      <div className="flex flex-col gap-3 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">每日估算费用 (Daily):</span>
          <span className="text-slate-200 font-bold">${dailyTotal.toFixed(2)} / 天</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">月度估算费用 (Monthly):</span>
          <span className="text-slate-200 font-bold">${monthlyTotal.toFixed(2)} / 月</span>
        </div>
        <div className="flex justify-between border-b border-slate-900 pb-3">
          <span className="text-slate-400">季度估算费用 (Quarterly):</span>
          <span className="text-slate-200 font-bold">${(monthlyTotal * 3).toFixed(2)} / 季</span>
        </div>
        <div className="flex justify-between text-sm pt-1">
          <span className="text-slate-300 font-sans font-bold">年度估算总费用 (Annual):</span>
          <span className="text-cyan-400 font-bold">
            ${(monthlyTotal * 12).toFixed(2)} / 年
          </span>
        </div>
      </div>

      {/* Performance status card */}
      <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/80 flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-mono">架构性能评级:</span>
          <span className={`font-bold font-mono flex items-center gap-1 ${perfRating.color}`}>
            <Gauge size={13} /> {perfRating.grade}
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {perfRating.desc}
        </p>
      </div>

      {/* Cloud Preflight & Save trigger buttons */}
      <div className="flex gap-2">
        <button
          onClick={onPreflightValidate}
          disabled={isValidatingCloud}
          className="flex-1 py-3 border border-cyan-800/50 bg-transparent hover:bg-cyan-950/30 text-cyan-400 font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          <Cloud size={14} />
          <span>{isValidatingCloud ? '正在云端预检...' : '☁️ 云端预检'}</span>
        </button>
        <button
          onClick={onSaveConfig}
          disabled={isSaving}
          className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-cyan-950/30 disabled:opacity-50"
        >
          <Save size={14} />
          <span>{isSaving ? '正在动态编译拓扑...' : '一键生成拓扑并验证 .azure/'}</span>
        </button>
      </div>

      {/* Download IaC Package */}
      <button
        onClick={onDownloadPackage}
        className="w-full py-3 border border-amber-800/40 bg-transparent hover:bg-amber-950/20 text-amber-400 font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
      >
        <Download size={14} />
        <span>📦 导出 IaC 压缩包</span>
      </button>

      {/* Save Status Message */}
      {saveMessage && (
        <div className={`p-3 rounded-lg border text-[11px] font-mono leading-relaxed ${
          saveMessage.type === 'success' 
            ? 'bg-emerald-950/20 border-emerald-900/60 text-emerald-400' 
            : 'bg-rose-950/20 border-rose-900/60 text-rose-400'
        }`}>
          {saveMessage.text}
        </div>
      )}
    </div>
  );
};
