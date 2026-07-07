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
  Server,
  Activity,
  ChevronRight
} from 'lucide-react';
import BicepTopologyCanvas from '@/components/canvas/BicepTopologyCanvas';

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
  vfs: Record<string, string>;
}

function highlightJson(jsonStr: string): string {
  if (!jsonStr) return '';
  return jsonStr
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'text-emerald-400'; // String value (green)
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-cyan-400 font-semibold'; // Key (cyan)
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-orange-400 font-bold'; // Boolean (orange)
        } else if (/null/.test(match)) {
          cls = 'text-slate-500 font-mono'; // Null (grey)
        } else {
          cls = 'text-indigo-300'; // Number (purple/indigo)
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
}

export default function IaCConfigDashboard() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'topology' | 'parameters'>('topology');

  // Navigation states for Bicep files inside the canvas
  const [activeFile, setActiveFile] = useState<string>('main.bicep');
  const [pathStack, setPathStack] = useState<string[]>(['main.bicep']);

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

  const handleModuleNavigate = (modulePath: string) => {
    let resolved = modulePath.replace('./', '');
    if (config?.vfs && (config.vfs[resolved] || config.vfs[`./${resolved}`])) {
      setActiveFile(resolved);
      setPathStack(prev => {
        if (prev.includes(resolved)) return prev;
        return [...prev, resolved];
      });
    }
  };

  const handleBreadcrumbClick = (idx: number) => {
    const nextStack = pathStack.slice(0, idx + 1);
    setPathStack(nextStack);
    setActiveFile(nextStack[nextStack.length - 1]);
  };

  const getScenarioLabel = (scenario: string) => {
    switch (scenario) {
      case 'sandbox': return '零特特权极简沙箱 (Sandbox)';
      case 'secure-iot': return '零信任身网双锁隔离 (Secure IoT)';
      case 'global-portal': return '全球分发边缘网关 (Portal)';
      case 'custom': return '自定义混合场景 (Custom)';
      default: return scenario;
    }
  };

  return (
    <main className="min-h-screen bg-[#070b13] text-slate-100 font-sans p-6 md:p-10 select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 border-b border-slate-900 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-1 flex items-center gap-1.5">
            <Terminal size={12} /> IAC_PROVISION_DASHBOARD
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            IaC 拓扑与编排看板
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">
            读取本地编译状态，将全局云参数与 Bicep 模块依赖链（ VFS ）整合进行双维度直观呈现。
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

      <div className="max-w-7xl mx-auto space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <div className="text-slate-500 text-xs font-mono">正在检索本地 IaC 物理配置...</div>
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
          /* Main Dashboard Content */
          <>
            {/* Top Row: Summarized Settings Grid (4 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Scenario */}
              <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-4 space-y-2.5">
                <div className="text-[10px] font-mono tracking-wider text-slate-500 flex items-center gap-1.5 uppercase">
                  <Shield size={12} className="text-cyan-400" /> Scenario
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-300">当前激活场景</div>
                  <div className="text-sm font-bold text-slate-200 mt-1 truncate">
                    {getScenarioLabel(config.uiState.activeScenario)}
                  </div>
                </div>
              </div>

              {/* Card 2: Network VNet */}
              <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-4 space-y-2.5">
                <div className="text-[10px] font-mono tracking-wider text-slate-500 flex items-center gap-1.5 uppercase">
                  <Network size={12} className="text-amber-400" /> Virtual Network
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-300">骨干 CIDR 网段</div>
                  <div className="text-sm font-bold text-slate-200 mt-1 font-mono">
                    {config.uiState.vnetAddressPrefix || '10.1.0.0/16'}
                  </div>
                </div>
              </div>

              {/* Card 3: Prefix & Location */}
              <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-4 space-y-2.5">
                <div className="text-[10px] font-mono tracking-wider text-slate-500 flex items-center gap-1.5 uppercase">
                  <Cpu size={12} className="text-emerald-400" /> Global Scope
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-300">前缀 / 物理区域</div>
                  <div className="text-sm font-bold text-slate-200 mt-1 font-mono">
                    {config.uiState.prefix} / {config.uiState.location}
                  </div>
                </div>
              </div>

              {/* Card 4: Active SKUs */}
              <div className="rounded-xl border border-slate-900 bg-slate-900/10 p-4 space-y-2.5">
                <div className="text-[10px] font-mono tracking-wider text-slate-500 flex items-center gap-1.5 uppercase">
                  <Database size={12} className="text-indigo-400" /> SKU Pricing
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-300">已激活服务计费项</div>
                  <div className="text-sm font-bold text-[#00f2fe] mt-1 font-mono">
                    {Object.values(config.uiState.selectedSkus).filter(x => x !== 'none').length} 个服务已激活
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Row: Tabbed Detail Area */}
            <div className="space-y-4">
              
              {/* Tab Toggles */}
              <div className="flex border-b border-slate-900 gap-6">
                <button
                  onClick={() => setActiveTab('topology')}
                  className={`pb-3 text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 ${
                    activeTab === 'topology' 
                      ? 'border-b-2 border-[#00f2fe] text-cyan-400' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Activity size={14} /> 🖼️ 物理拓扑依赖关系图 (Topology Diagram)
                </button>
                <button
                  onClick={() => setActiveTab('parameters')}
                  className={`pb-3 text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 ${
                    activeTab === 'parameters' 
                      ? 'border-b-2 border-[#00f2fe] text-cyan-400' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Server size={14} /> 💻 parameters.json 变量预览 (Variables Preview)
                </button>
              </div>

              {/* Tab Contents */}
              {activeTab === 'topology' ? (
                /* Tab 1: Interactive Canvas Diagram */
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Canvas Breadcrumbs */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono px-1">
                    <span className="text-slate-500">拓扑视角:</span>
                    {pathStack.map((file, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <ChevronRight size={12} className="text-slate-700" />}
                        <button 
                          onClick={() => handleBreadcrumbClick(idx)}
                          className={`hover:text-cyan-400 transition-colors ${
                            idx === pathStack.length - 1 ? 'text-cyan-400 font-bold border-b border-cyan-400/50' : 'text-slate-300'
                          }`}
                        >
                          {file}
                        </button>
                      </React.Fragment>
                    ))}
                    {pathStack.length > 1 && (
                      <button 
                        onClick={() => {
                          setPathStack(['main.bicep']);
                          setActiveFile('main.bicep');
                        }}
                        className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded"
                      >
                        重置主视角 [main.bicep]
                      </button>
                    )}
                  </div>

                  {/* Diagram Component */}
                  <div className="h-[520px] w-full border border-slate-900 bg-slate-950/80 rounded-2xl overflow-hidden shadow-inner relative">
                    <BicepTopologyCanvas 
                      bicepCode={config.vfs[activeFile] || config.vfs['./' + activeFile] || config.vfs['main.bicep'] || ''}
                      currentFile={activeFile}
                      onModuleNavigate={handleModuleNavigate}
                    />
                  </div>
                </div>
              ) : (
                /* Tab 2: Parameters JSON Code Block */
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center px-1">
                    <div className="text-[10px] font-mono tracking-widest text-slate-500 flex items-center gap-1.5 uppercase">
                      <Terminal size={12} className="text-purple-400" /> parameters.json
                    </div>
                    <button 
                      onClick={handleCopy}
                      className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700"
                    >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copied ? '已复制' : '复制 JSON'}
                    </button>
                  </div>
                  <div className="rounded-2xl border border-slate-900 bg-slate-950/80 p-5 font-mono text-xs overflow-auto h-[500px] shadow-inner select-text">
                    <pre 
                      className="text-slate-300 whitespace-pre leading-relaxed font-mono"
                      dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(config.parameters, null, 2)) }}
                    />
                  </div>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </main>
  );
}