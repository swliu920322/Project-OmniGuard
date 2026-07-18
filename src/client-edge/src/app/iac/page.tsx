'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';
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
  const { t, locale } = useI18n();
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
      case 'sandbox': 
        return locale === 'zh' ? '零特特权极简沙箱 (Sandbox)' : 'Privilege-Free Sandbox (Sandbox)';
      case 'secure-iot': 
        return locale === 'zh' ? '零信任身网双锁隔离 (Secure IoT)' : 'Zero-Trust Network Isolation (Secure IoT)';
      case 'global-portal': 
        return locale === 'zh' ? '全球分发边缘网关 (Portal)' : 'Global Distribution API Gateway (Portal)';
      case 'custom': 
        return locale === 'zh' ? '自定义混合场景 (Custom)' : 'Custom Hybrid Integration (Custom)';
      default: 
        return scenario;
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0e17] text-slate-100 font-sans p-4 md:py-8 md:px-8 select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="max-w-8xl mx-auto mb-8 border-b border-slate-900 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-1 flex items-center gap-1.5">
            <Terminal size={12} /> IAC_PROVISION_DASHBOARD
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {t('iac.title')}
          </h1>
          <p className="text-xs text-slate-300 font-mono mt-1">
            {t('iac.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/iac/configurator" 
            className="text-xs font-mono border border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-500 hover:text-slate-950 hover:border-cyan-400 px-4 py-2.5 rounded-xl text-cyan-400 font-bold transition-all shadow-xl flex items-center gap-1.5"
          >
            <Settings size={14} /> {t('iac.btn_configurator')}
          </Link>
          {config && (
            <a 
              href="/api/download-iac"
              className="text-xs font-mono border border-slate-800 bg-slate-900 hover:border-cyan-500 px-4 py-2.5 rounded-xl text-slate-300 hover:text-slate-100 transition-all shadow-xl flex items-center gap-1.5"
            >
              <Download size={14} /> {t('iac.btn_download')}
            </a>
          )}
        </div>
      </div>

      <div className="max-w-8xl mx-auto space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <div className="text-slate-300 text-xs font-mono">{t('common.loading')}</div>
          </div>
        ) : !config ? (
          /* Empty State */
          <div className="rounded-2xl border border-dashed border-slate-900 bg-[#111625] p-12 text-center max-w-2xl mx-auto space-y-6 shadow-2xl">
            <div className="flex justify-center text-slate-600">
              <AlertCircle size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-300">{t('iac.empty_title')}</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                {t('iac.empty_desc')}
              </p>
            </div>
            <Link 
              href="/iac/configurator" 
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold rounded-xl transition-all shadow-lg"
            >
              <Settings size={14} /> {t('iac.empty_btn')}
            </Link>
          </div>
        ) : (
          /* Main Dashboard Content */
          <>
            {/* Top Row: Summarized Settings Grid (4 columns) - Glassmorphism & Hover glow */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Scenario */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md p-4 space-y-2.5 shadow-lg hover:border-cyan-500/30 hover:bg-slate-900/60 transition-all duration-300 group hover:shadow-[0_0_25px_rgba(0,242,254,0.06)]">
                <div className="text-[10px] font-mono tracking-wider text-slate-300 flex items-center gap-1.5 uppercase font-semibold group-hover:text-cyan-400 transition-colors">
                  <Shield size={12} className="text-cyan-400" /> {t('iac.card_scenario')}
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-300">{t('iac.card_scenario_desc')}</div>
                  <div className="text-sm font-bold text-slate-200 mt-1 truncate">
                    {getScenarioLabel(config.uiState.activeScenario)}
                  </div>
                </div>
              </div>

              {/* Card 2: Network VNet */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md p-4 space-y-2.5 shadow-lg hover:border-cyan-500/30 hover:bg-slate-900/60 transition-all duration-300 group hover:shadow-[0_0_25px_rgba(0,242,254,0.06)]">
                <div className="text-[10px] font-mono tracking-wider text-slate-300 flex items-center gap-1.5 uppercase font-semibold group-hover:text-amber-400 transition-colors">
                  <Network size={12} className="text-amber-400" /> {t('iac.card_vnet')}
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-300">{t('iac.card_vnet_desc')}</div>
                  <div className="text-sm font-bold text-slate-200 mt-1 font-mono">
                    {config.uiState.vnetAddressPrefix || '10.1.0.0/16'}
                  </div>
                </div>
              </div>

              {/* Card 3: Prefix & Location */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md p-4 space-y-2.5 shadow-lg hover:border-cyan-500/30 hover:bg-slate-900/60 transition-all duration-300 group hover:shadow-[0_0_25px_rgba(0,242,254,0.06)]">
                <div className="text-[10px] font-mono tracking-wider text-slate-300 flex items-center gap-1.5 uppercase font-semibold group-hover:text-emerald-400 transition-colors">
                  <Cpu size={12} className="text-emerald-400" /> {t('iac.card_scope')}
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-300">{t('iac.card_scope_desc')}</div>
                  <div className="text-sm font-bold text-slate-200 mt-1 font-mono">
                    {config.uiState.prefix} / {config.uiState.location}
                  </div>
                </div>
              </div>

              {/* Card 4: Active SKUs */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md p-4 space-y-2.5 shadow-lg hover:border-cyan-500/30 hover:bg-slate-900/60 transition-all duration-300 group hover:shadow-[0_0_25px_rgba(0,242,254,0.06)]">
                <div className="text-[10px] font-mono tracking-wider text-slate-300 flex items-center gap-1.5 uppercase font-semibold group-hover:text-indigo-400 transition-colors">
                  <Database size={12} className="text-indigo-400" /> {t('iac.card_sku')}
                </div>
                <div>
                  <div className="text-xs font-mono text-slate-300">{t('iac.card_sku_desc')}</div>
                  <div className="text-sm font-bold text-[#00f2fe] mt-1 font-mono">
                    {locale === 'zh' ? (
                      <>
                        {Object.values(config.uiState.selectedSkus).filter(x => x !== 'none').length} {t('iac.card_sku_active')}
                      </>
                    ) : (
                      <>
                        {Object.values(config.uiState.selectedSkus).filter(x => x !== 'none').length} {t('iac.card_sku_active')}
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Row: Tabbed Detail Area */}
            <div className="space-y-4">
              
              {/* Tab Toggles - Brightened inactive tabs */}
              <div className="flex border-b border-slate-800 gap-6">
                <button
                  onClick={() => setActiveTab('topology')}
                  className={`pb-3 text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 ${
                    activeTab === 'topology' 
                      ? 'border-b-2 border-[#00f2fe] text-cyan-400' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity size={14} /> {t('iac.tab_topology')}
                </button>
                <button
                  onClick={() => setActiveTab('parameters')}
                  className={`pb-3 text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 ${
                    activeTab === 'parameters' 
                      ? 'border-b-2 border-[#00f2fe] text-cyan-400' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Server size={14} /> {t('iac.tab_parameters')}
                </button>
              </div>

              {/* Tab Contents */}
              {activeTab === 'topology' ? (
                /* Tab 1: Interactive Canvas Diagram */
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Canvas Breadcrumbs */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono px-1">
                    <span className="text-slate-400">{t('iac.canvas_perspective')}:</span>
                    {pathStack.map((file, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <ChevronRight size={12} className="text-slate-800" />}
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
                        className="ml-auto text-[10px] text-slate-300 hover:text-slate-100 font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded"
                      >
                        {t('iac.canvas_reset')}
                      </button>
                    )}
                  </div>

                  {/* Diagram Component */}
                  <div className="h-[520px] w-full border border-slate-800/80 bg-slate-950/80 rounded-2xl overflow-hidden shadow-2xl relative">
                    <BicepTopologyCanvas 
                      bicepCode={config.vfs[activeFile] || config.vfs['./' + activeFile] || config.vfs['main.bicep'] || ''}
                      currentFile={activeFile}
                      onModuleNavigate={handleModuleNavigate}
                    />
                  </div>
                </div>
              ) : (
                /* Tab 2: Parameters JSON Code Block - Brightened metadata title to slate-300 */
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center px-1">
                    <div className="text-[10px] font-mono tracking-widest text-slate-300 flex items-center gap-1.5 uppercase font-semibold">
                      <Terminal size={12} className="text-purple-400" /> parameters.json
                    </div>
                    <button 
                      onClick={handleCopy}
                      className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700"
                    >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copied ? t('iac.json_copied') : t('iac.json_copy')}
                    </button>
                  </div>
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/85 p-5 font-mono text-xs overflow-auto h-[500px] shadow-2xl select-text">
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