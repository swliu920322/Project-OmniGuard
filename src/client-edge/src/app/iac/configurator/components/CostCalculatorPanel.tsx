import React from 'react';
import { Coins, Gauge, ShieldCheck, ShieldAlert, Save, Cloud, Download } from 'lucide-react';

interface CostCalculatorPanelProps {
  remainingBudget: number;
  setRemainingBudget: (v: number) => void;
  daysRemaining: number;
  setDaysRemaining: (v: number) => void;
  monthlyTotal: number;
  dailyTotal: number;
  projectedCost: number;
  isBudgetSafe: boolean;
  perfRating: { grade: string; color: string; desc: string };
  isSaving: boolean;
  isValidatingCloud: boolean;
  saveMessage: { type: 'success' | 'error'; text: string } | null;
  onSaveConfig: () => void;
  onPreflightValidate: () => Promise<void>;
  onDownloadPackage: () => void;
}

export const CostCalculatorPanel: React.FC<CostCalculatorPanelProps> = ({
  remainingBudget,
  setRemainingBudget,
  daysRemaining,
  setDaysRemaining,
  monthlyTotal,
  dailyTotal,
  projectedCost,
  isBudgetSafe,
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
      <h2 className="text-xs font-bold font-mono text-slate-400 border-b border-slate-900 pb-2 flex items-center gap-2 uppercase tracking-wider">
        <Coins size={15} className="text-cyan-400" />
        <span>03. 账单测算与架构评级</span>
      </h2>

      {/* Configurable subscription info */}
      <div className="grid grid-cols-2 gap-4 font-mono text-xs border-b border-slate-900 pb-4">
        <div>
          <label className="block text-slate-400 mb-1 uppercase font-semibold">当前订阅余额 (USD)</label>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 py-1">
            <span className="text-slate-400 mr-1">$</span>
            <input 
              type="number" 
              value={remainingBudget}
              onChange={(e) => setRemainingBudget(Number(e.target.value))}
              className="bg-transparent text-slate-200 outline-none w-full font-bold"
            />
          </div>
        </div>
        <div>
          <label className="block text-slate-400 mb-1 uppercase font-semibold">距离到期天数 (Day)</label>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 py-1">
            <input 
              type="number" 
              value={daysRemaining}
              onChange={(e) => setDaysRemaining(Number(e.target.value))}
              className="bg-transparent text-slate-200 outline-none w-full font-bold"
            />
            <span className="text-slate-400 ml-1">天</span>
          </div>
        </div>
      </div>

      {/* Calculations display */}
      <div className="flex flex-col gap-3 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">拓扑估算月度总价:</span>
          <span className="text-slate-200 font-bold">${monthlyTotal.toFixed(2)} / 月</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">折合每日消费:</span>
          <span className="text-slate-200 font-bold">${dailyTotal.toFixed(2)} / 天</span>
        </div>
        <div className="flex justify-between border-t border-slate-900 pt-3 text-sm">
          <span className="text-slate-400 font-sans font-bold">测试期 ({daysRemaining}天) 预计总消费:</span>
          <span className={`font-bold ${isBudgetSafe ? 'text-emerald-400' : 'text-rose-500'}`}>
            ${projectedCost.toFixed(2)}
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

      {/* Health alert badge */}
      <div className={`p-4 rounded-xl border flex items-start space-x-3 text-xs leading-relaxed ${
        isBudgetSafe 
          ? 'bg-emerald-950/20 border-emerald-900/60 text-emerald-400' 
          : 'bg-rose-950/20 border-rose-900/60 text-rose-400'
      }`}>
        {isBudgetSafe ? (
          <>
            <ShieldCheck size={20} className="shrink-0 text-emerald-400" />
            <div>
              <h5 className="font-bold">预算水位正常 (Safe)</h5>
              <p className="mt-0.5 text-slate-400 font-sans leading-relaxed">
                预计到期后您的订阅账户仍将富余 <b>${(remainingBudget - projectedCost).toFixed(2)}</b>，可以放心部署。
              </p>
            </div>
          </>
        ) : (
          <>
            <ShieldAlert size={20} className="shrink-0 text-rose-400" />
            <div>
              <h5 className="font-bold">预算存在击穿风险 (Over Budget)</h5>
              <p className="mt-0.5 text-slate-400 font-sans leading-relaxed">
                预估总费用已超标 <b>${(projectedCost - remainingBudget).toFixed(2)}</b>。建议开启<b>“FinOps 绿能休眠包”</b>或切换为 Sandbox 规格。
              </p>
            </div>
          </>
        )}
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
            ? 'bg-emerald-950/40 border-emerald-900/40 text-emerald-400' 
            : 'bg-rose-950/40 border-rose-900/40 text-rose-400'
        }`}>
          {saveMessage.text}
        </div>
      )}
    </div>
  );
};
