'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Terminal, 
  Settings, 
  Copy, 
  Check, 
  Download, 
  Shield, 
  Cpu, 
  Network, 
  AlertCircle,
  Database,
  Layers,
  Server
} from 'lucide-react';

interface ConfigState {
  uiState: {
    activeScenario: string;
    selectedSkus: Record<string, string>;
    deployManagedIdentities: boolean;
    deployStaticWebApp: boolean;
    prefix: string;
    location: string;
    customResourceGroupName: string;
    costCenter: string;
    finOpsOwner: string;
    vnetAddressPrefix: string;
    backendSubnetPrefix: string;
    storageSubnetPrefix: string;
  };
  parameters: Record<string, any>;
}

export default function IaCConfigDashboard() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/save-iac-config');
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
        }
      } catch (err) {
        console.error('Failed to load saved config:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleCopy = () => {
    if (!config) return;
    const formattedParams = {
      $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
      contentVersion: "1.0.0.0",
      parameters: Object.entries(config.parameters).reduce((acc, [key, val]) => {
        acc[key] = { value: val };
        return acc;
      }, {} as Record<string, { value: any }>)
    };
    navigator.clipboard.writeText(JSON.stringify(formattedParams, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getScenarioLabel = (scenario: string) => {
    switch (scenario) {
      case 'sandbox': return '零特特权极简沙箱';
      case 'secure-iot': return '零信任身网双锁隔离';
      case 'global-portal': return '全球分发边缘网关';
      case 'custom': return '自定义混合场景 (Custom)';
      default: return scenario;
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12 select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10 border-b border-slate-900 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-1 flex items-center gap-1.5">
            <Terminal size={12} /> IAC_PROVISION_DASHBOARD
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            本地激活的 IaC 架构看板
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">
            实时读取本地 <code className="text-cyan-500 bg-slate-900 px-1 py-0.5 rounded">.azure/configurator-ui-state.json</code> 存档，呈现已持久化的物理拓扑数据。
          </p>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/iac/configurator" 
            className="text-xs font-mono border border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-500 hover:text-slate-950 hover:border-cyan-400 px-4 py-2.5 rounded-xl text-cyan-400 font-bold transition-all shadow-xl flex items-center gap-1.5"
          >
            <Settings size={14} /> ⚙️ 进入配置台调优
          </Link>
          {config && (
            <a 
              href="/api/download-iac"
              className="text-xs font-mono border border-slate-800 bg-slate-900 hover:border-cyan-500 px-4 py-2.5 rounded-xl text-slate-300 hover:text-slate-100 transition-all shadow-xl flex items-center gap-1.5"
            >
              <Download size={14} /> 📥 打包下载 IaC 包
            </a>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <div className="text-slate-500 text-xs font-mono">正在检索本地 IaC 记忆配置...</div>
          </div>
        ) : !config ? (
          /* Empty State */
          <div className="rounded-2xl border border-dashed border-slate-900 bg-[#0d1321]/10 p-12 text-center max-w-2xl mx-auto space-y-6">
            <div className="flex justify-center text-slate-600">
              <AlertCircle size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-300">尚未保存任何本地架构配置</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                您的本地工作区中目前没有有效的配置文件。请点击下方按钮进入可视化配置中心，微调您的云端算力网络与托管凭证。
              </p>
            </div>
            <Link 
              href="/iac/configurator"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold rounded-xl transition-all shadow-lg"
            >
              <Settings size={14} /> 立即开始配置第一套拓扑
            </Link>
          </div>
        ) : (
          /* Dashboard Layout */
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            
            {/* Left Column: Visual Config Summary (3/5 cols) */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* 🎯 Scenario Badge & Header */}
              <div className="rounded-2xl border border-slate-900 bg-[#0d1321]/30 p-5 space-y-4">
                <div className="flex justify-between items-center gap-3">
                  <div className="text-xs font-mono tracking-widest text-slate-500 flex items-center gap-1.5">
                    <Shield size={13} className="text-cyan-400" /> ACTIVE_SCENARIO
                  </div>
                  <span className="text-[10px] font-mono border border-cyan-500/20 px-2 py-0.5 rounded bg-cyan-500/5 text-cyan-400">
                    STATUS_ACTIVE
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-200">
                    {getScenarioLabel(config.uiState.activeScenario)}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 font-sans">
                    已基于选定的部署特性对编译模板进行动态锁定。当前部署将拉起核心计算容器及配套的隔离凭证通道。
                  </p>
                </div>
              </div>

              {/* 🌐 Network topology details */}
              <div className="rounded-2xl border border-slate-900 bg-[#0d1321]/30 p-5 space-y-4">
                <div className="text-xs font-mono tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Network size={13} className="text-amber-400" /> NETWORK_TOPOLOGY
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-slate-900/80 bg-slate-950/60 p-3.5 rounded-xl space-y-1">
                    <div className="text-[10px] font-mono text-slate-600">虚拟网骨干 (VNet)</div>
                    <div className="text-xs font-mono text-slate-300 font-bold">{config.uiState.vnetAddressPrefix || '10.1.0.0/16'}</div>
                  </div>
                  <div className="border border-slate-900/80 bg-slate-950/60 p-3.5 rounded-xl space-y-1">
                    <div className="text-[10px] font-mono text-slate-600">应用子网 (Apps Subnet)</div>
                    <div className="text-xs font-mono text-slate-300 font-bold">{config.uiState.backendSubnetPrefix || '10.1.4.0/23'}</div>
                  </div>
                  <div className="border border-slate-900/80 bg-slate-950/60 p-3.5 rounded-xl space-y-1">
                    <div className="text-[10px] font-mono text-slate-600">端点子网 (Storage Subnet)</div>
                    <div className="text-xs font-mono text-slate-300 font-bold">{config.uiState.storageSubnetPrefix || '10.1.2.0/24'}</div>
                  </div>
                </div>
              </div>

              {/* 📦 Global Variables */}
              <div className="rounded-2xl border border-slate-900 bg-[#0d1321]/30 p-5 space-y-4">
                <div className="text-xs font-mono tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Cpu size={13} className="text-emerald-400" /> GLOBAL_VARIABLES
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <span className="text-xs text-slate-500 font-sans">租户前缀 (Prefix)</span>
                    <span className="text-xs text-slate-300 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-900">{config.uiState.prefix}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <span className="text-xs text-slate-500 font-sans">托管区域 (Location)</span>
                    <span className="text-xs text-slate-300 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-900">{config.uiState.location}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <span className="text-xs text-slate-500 font-sans">托管身份 (Entra MI)</span>
                    <span className={`text-xs font-mono font-bold ${config.uiState.deployManagedIdentities ? 'text-cyan-400' : 'text-slate-500'}`}>
                      {config.uiState.deployManagedIdentities ? '已启用 Managed Identity' : '无托管身份 (退回明文)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <span className="text-xs text-slate-500 font-sans">边缘 Ingress (SWA)</span>
                    <span className={`text-xs font-mono font-bold ${config.uiState.deployStaticWebApp ? 'text-cyan-400' : 'text-slate-500'}`}>
                      {config.uiState.deployStaticWebApp ? '已挂载 Static Web App' : '未挂载'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center md:border-none pb-3 md:pb-0">
                    <span className="text-xs text-slate-500 font-sans">成本中心 (CostCenter)</span>
                    <span className="text-xs text-slate-300 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-900">{config.uiState.costCenter || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-sans">FinOps 负责人 (Owner)</span>
                    <span className="text-xs text-slate-300 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-900">{config.uiState.finOpsOwner || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* 📋 SKU Billing Profiling */}
              <div className="rounded-2xl border border-slate-900 bg-[#0d1321]/30 p-5 space-y-4">
                <div className="text-xs font-mono tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Database size={13} className="text-indigo-400" /> SKU_BILLING_PROFILE
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(config.uiState.selectedSkus).map(([service, sku]) => (
                    sku !== 'none' && (
                      <div key={service} className="bg-slate-950/40 border border-slate-900/60 p-3 rounded-xl flex flex-col justify-between gap-1 shadow">
                        <div className="text-[10px] font-mono text-slate-500 uppercase">{service}</div>
                        <div className="text-xs font-mono text-slate-300 font-bold truncate">{sku}</div>
                      </div>
                    )
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Code Parameter Preview (2/5 cols) */}
            <div className="lg:col-span-2 flex flex-col h-full space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-xs font-mono tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Server size={13} className="text-purple-400" /> PARAMETERS_PREVIEW
                </div>
                <button 
                  onClick={handleCopy}
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied ? '已复制' : '复制 JSON'}
                </button>
              </div>

              <div className="flex-1 rounded-2xl border border-slate-900 bg-slate-950/80 p-4 font-mono text-xs overflow-auto max-h-[560px] shadow-inner">
                <pre className="text-slate-300 whitespace-pre leading-relaxed select-text">
                  {JSON.stringify(config.parameters, null, 2)}
                </pre>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}