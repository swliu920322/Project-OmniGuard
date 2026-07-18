import React from 'react';
import { useI18n } from '@/components/I18nProvider';
import { Lock, Globe, Cpu, Network, Activity } from 'lucide-react';

interface FeaturePacksSelectorProps {
  packZeroTrust: boolean;
  packGlobalWaf: boolean;
  packScaleToZero: boolean;
  packIoTDps: boolean;
  onTogglePack: (packType: string, val: boolean) => void;
}

export const FeaturePacksSelector: React.FC<FeaturePacksSelectorProps> = ({
  packZeroTrust,
  packGlobalWaf,
  packScaleToZero,
  packIoTDps,
  onTogglePack
}) => {
  const { t, locale } = useI18n();

  return (
    <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative">
      <h2 className="text-xs font-bold font-mono text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-900 pb-2 uppercase tracking-wider">
        <Activity size={15} className="text-cyan-400" />
        <span>{t('configurator.sec_features')}</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Pack 1: Zero Trust Network */}
        <div className={`p-4 rounded-xl border transition-all ${packZeroTrust ? 'bg-cyan-950/10 border-cyan-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className={`size-4 ${packZeroTrust ? 'text-cyan-400' : 'text-slate-500'}`} />
              <h4 className="text-xs font-bold font-mono text-slate-200">{t('configurator.feature_zero_trust_title')}</h4>
            </div>
            <input 
              type="checkbox" 
              checked={packZeroTrust}
              onChange={(e) => onTogglePack('zeroTrust', e.target.checked)}
              className="accent-cyan-400 cursor-pointer size-4"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {t('configurator.feature_zero_trust_desc')}
          </p>
          <div className="mt-2.5 font-mono text-xs flex items-center justify-between text-cyan-400 bg-cyan-950/30 px-2 py-1.5 rounded">
            <span>{locale === 'zh' ? '性能指标: 虚网内网隔离 | 时延 <5ms' : 'Metrics: Private Link Isolation | Latency <5ms'}</span>
            <span>{locale === 'zh' ? '成本影响: +$24/月' : 'Cost: +$24/month'}</span>
          </div>
        </div>

        {/* Pack 2: Global traffic accelerator */}
        <div className={`p-4 rounded-xl border transition-all ${packGlobalWaf ? 'bg-amber-950/10 border-amber-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className={`size-4 ${packGlobalWaf ? 'text-amber-400' : 'text-slate-500'}`} />
              <h4 className="text-xs font-bold font-mono text-slate-200">{t('configurator.feature_waf_title')}</h4>
            </div>
            <input 
              type="checkbox" 
              checked={packGlobalWaf}
              onChange={(e) => onTogglePack('globalWaf', e.target.checked)}
              className="accent-amber-400 cursor-pointer size-4"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {t('configurator.feature_waf_desc')}
          </p>
          <div className="mt-2.5 font-mono text-xs flex items-center justify-between text-amber-400 bg-amber-950/30 px-2 py-1.5 rounded">
            <span>{locale === 'zh' ? '性能指标: 全球时延 <30ms | 智能 WAF 防御' : 'Metrics: Global Latency <30ms | Edge WAF'}</span>
            <span>{locale === 'zh' ? '成本影响: +$477/月' : 'Cost: +$477/month'}</span>
          </div>
        </div>

        {/* Pack 3: Scale to Zero FinOps */}
        <div className={`p-4 rounded-xl border transition-all ${packScaleToZero ? 'bg-emerald-950/10 border-emerald-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className={`size-4 ${packScaleToZero ? 'text-emerald-400' : 'text-slate-500'}`} />
              <h4 className="text-xs font-bold font-mono text-slate-200">{t('configurator.feature_scale_title')}</h4>
            </div>
            <input 
              type="checkbox" 
              checked={packScaleToZero}
              onChange={(e) => onTogglePack('scaleToZero', e.target.checked)}
              className="accent-emerald-400 cursor-pointer size-4"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {t('configurator.feature_scale_desc')}
          </p>
          <div className="mt-2.5 font-mono text-xs flex items-center justify-between text-emerald-400 bg-emerald-950/30 px-2 py-1.5 rounded">
            <span>{locale === 'zh' ? '性能指标: 存在 2-5秒 的容器冷启动时延' : 'Metrics: 2-5s Container Cold-Start Latency'}</span>
            <span>{locale === 'zh' ? '成本影响: 缩减 90% 闲置开销' : 'Cost: Saves 90% Idle Compute Cost'}</span>
          </div>
        </div>

        {/* Pack 4: IoT DPS device provisioning */}
        <div className={`p-4 rounded-xl border transition-all ${packIoTDps ? 'bg-purple-950/10 border-purple-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className={`size-4 ${packIoTDps ? 'text-purple-400' : 'text-slate-500'}`} />
              <h4 className="text-xs font-bold font-mono text-slate-200">{t('configurator.feature_dps_title')}</h4>
            </div>
            <input 
              type="checkbox" 
              checked={packIoTDps}
              onChange={(e) => onTogglePack('ioTDps', e.target.checked)}
              className="accent-purple-400 cursor-pointer size-4"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {t('configurator.feature_dps_desc')}
          </p>
          <div className="mt-2.5 font-mono text-xs flex items-center justify-between text-purple-400 bg-purple-950/30 px-2 py-1.5 rounded">
            <span>{locale === 'zh' ? '性能指标: 每日 400,000 遥测吞吐' : 'Metrics: 400,000 Daily Telemetry Ingestion'}</span>
            <span>{locale === 'zh' ? '成本影响: +$25/月' : 'Cost: +$25/month'}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
