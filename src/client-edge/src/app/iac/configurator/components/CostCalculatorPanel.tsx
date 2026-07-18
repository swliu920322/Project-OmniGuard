import React from 'react';
import { useI18n } from '@/components/I18nProvider';
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
  const { t } = useI18n();

  return (
    <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative flex flex-col gap-5">
      <h2 className="text-xs font-bold font-mono text-slate-400 border-b border-slate-900 pb-2 flex items-center gap-2 uppercase tracking-wider font-sans">
        <Coins size={15} className="text-cyan-400" />
        <span>{t('configurator.sec_bill')}</span>
      </h2>

      {/* Calculations display */}
      <div className="flex flex-col gap-3 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">{t('configurator.daily')}</span>
          <span className="text-slate-200 font-bold">${dailyTotal.toFixed(2)} / {t('configurator.day')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">{t('configurator.monthly')}</span>
          <span className="text-slate-200 font-bold">${monthlyTotal.toFixed(2)} / {t('configurator.month')}</span>
        </div>
        <div className="flex justify-between border-b border-slate-900 pb-3">
          <span className="text-slate-400">{t('configurator.quarterly')}</span>
          <span className="text-slate-200 font-bold">${(monthlyTotal * 3).toFixed(2)} / {t('configurator.quarter')}</span>
        </div>
        <div className="flex justify-between text-sm pt-1">
          <span className="text-slate-300 font-sans font-bold">{t('configurator.annual')}</span>
          <span className="text-cyan-400 font-bold">
            ${(monthlyTotal * 12).toFixed(2)} / {t('configurator.year')}
          </span>
        </div>
      </div>

      {/* Performance status card */}
      <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/80 flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-mono">{t('configurator.perf_rating')}</span>
          <span className={`font-bold font-mono flex items-center gap-1 ${perfRating.color}`}>
            <Gauge size={13} /> {perfRating.grade}
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {perfRating.desc}
        </p>
      </div>

      {/* Cloud Preflight & Save action buttons - Redesigned hierarchy */}
      <div className="flex flex-col gap-2.5">
        {/* 🚀 Primary Action: Generate Bicep & verify local .azure/ */}
        <button
          onClick={onSaveConfig}
          disabled={isSaving}
          className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-cyan-950/20 disabled:opacity-50"
        >
          <Save size={14} />
          <span>{isSaving ? t('configurator.btn_compiling') : t('configurator.btn_generate')}</span>
        </button>

        {/* 🛠️ Secondary Actions: What-If Preflight & Export ZIP - Enhanced Hover feedback */}
        <div className="flex gap-2">
          <button
            onClick={onPreflightValidate}
            disabled={isValidatingCloud}
            className="flex-1 py-2.5 border border-cyan-500/30 bg-cyan-950/20 text-cyan-400 font-mono font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition-all hover:border-cyan-400 hover:bg-cyan-500 hover:text-slate-950 hover:shadow-[0_0_15px_rgba(0,242,254,0.15)] disabled:opacity-50 cursor-pointer"
          >
            <Cloud size={13} />
            <span>{isValidatingCloud ? t('configurator.btn_validating') : t('configurator.btn_preflight')}</span>
          </button>
          
          <button
            onClick={onDownloadPackage}
            className="flex-1 py-2.5 border border-amber-500/20 bg-amber-950/10 text-amber-400 font-mono font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition-all hover:border-amber-400 hover:bg-amber-500 hover:text-slate-950 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] cursor-pointer"
          >
            <Download size={13} />
            <span>{t('configurator.btn_export')}</span>
          </button>
        </div>
      </div>

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
