import React from 'react';
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
  return (
    <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative">
      <h2 className="text-xs font-bold font-mono text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-900 pb-2 uppercase tracking-wider">
        <Activity size={15} className="text-cyan-400" />
        <span>业务功能包快速启闭 (Feature Packs Toggles)</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Pack 1: Zero Trust Network */}
        <div className={`p-4 rounded-xl border transition-all ${packZeroTrust ? 'bg-cyan-950/10 border-cyan-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className={`size-4 ${packZeroTrust ? 'text-cyan-400' : 'text-slate-500'}`} />
              <h4 className="text-xs font-bold font-mono text-slate-200">零信任网络安全包</h4>
            </div>
            <input 
              type="checkbox" 
              checked={packZeroTrust}
              onChange={(e) => onTogglePack('zeroTrust', e.target.checked)}
              className="accent-cyan-400 cursor-pointer size-4"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            开启后强制停用数据组件（Cosmos/Storage）公网端点，自动编排 Private Link 和私有 DNS 劫持。
          </p>
          <div className="mt-2.5 font-mono text-xs flex items-center justify-between text-cyan-400 bg-cyan-950/30 px-2 py-1.5 rounded">
            <span>性能指标: 虚网内网隔离 | 时延 &lt;5ms</span>
            <span>成本影响: +$24/月</span>
          </div>
        </div>

        {/* Pack 2: Global traffic accelerator */}
        <div className={`p-4 rounded-xl border transition-all ${packGlobalWaf ? 'bg-amber-950/10 border-amber-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className={`size-4 ${packGlobalWaf ? 'text-amber-400' : 'text-slate-500'}`} />
              <h4 className="text-xs font-bold font-mono text-slate-200">全球边缘分发与 WAF 防护包</h4>
            </div>
            <input 
              type="checkbox" 
              checked={packGlobalWaf}
              onChange={(e) => onTogglePack('globalWaf', e.target.checked)}
              className="accent-amber-400 cursor-pointer size-4"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            部署 Front Door Premium 全球专线 CDN 与高级 WAF 防御规则，并挂载 APIM 网关，实施边缘反爬虫与 JWT 验证。
          </p>
          <div className="mt-2.5 font-mono text-xs flex items-center justify-between text-amber-400 bg-amber-950/30 px-2 py-1.5 rounded">
            <span>性能指标: 全球时延 &lt;30ms | 智能 WAF 防御</span>
            <span>成本影响: +$477/月</span>
          </div>
        </div>

        {/* Pack 3: Scale to Zero FinOps */}
        <div className={`p-4 rounded-xl border transition-all ${packScaleToZero ? 'bg-emerald-950/10 border-emerald-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className={`size-4 ${packScaleToZero ? 'text-emerald-400' : 'text-slate-500'}`} />
              <h4 className="text-xs font-bold font-mono text-slate-200">FinOps 绿能冷启动休眠包</h4>
            </div>
            <input 
              type="checkbox" 
              checked={packScaleToZero}
              onChange={(e) => onTogglePack('scaleToZero', e.target.checked)}
              className="accent-emerald-400 cursor-pointer size-4"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            开启后强制设置 ACA 最低副本数为 0。闲置时计算实例完全归零，测试请求时唤醒。
          </p>
          <div className="mt-2.5 font-mono text-xs flex items-center justify-between text-emerald-400 bg-emerald-950/30 px-2 py-1.5 rounded">
            <span>性能指标: 存在 2-5秒 的容器冷启动时延</span>
            <span>成本影响: 缩减 90% 闲置开销</span>
          </div>
        </div>

        {/* Pack 4: IoT DPS device provisioning */}
        <div className={`p-4 rounded-xl border transition-all ${packIoTDps ? 'bg-purple-950/10 border-purple-900/60' : 'bg-slate-950/30 border-slate-900'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className={`size-4 ${packIoTDps ? 'text-purple-400' : 'text-slate-500'}`} />
              <h4 className="text-xs font-bold font-mono text-slate-200">IoT 零接触安全接入包</h4>
            </div>
            <input 
              type="checkbox" 
              checked={packIoTDps}
              onChange={(e) => onTogglePack('ioTDps', e.target.checked)}
              className="accent-purple-400 cursor-pointer size-4"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            一键配置设备注册服务 (DPS)，支持海量智能设备通过 X.509 CA 证书进行动态安全免密注册。
          </p>
          <div className="mt-2.5 font-mono text-xs flex items-center justify-between text-purple-400 bg-purple-950/30 px-2 py-1.5 rounded">
            <span>性能指标: 每日 400,000 遥测吞吐</span>
            <span>成本影响: +$25/月</span>
          </div>
        </div>

      </div>
    </div>
  );
};
