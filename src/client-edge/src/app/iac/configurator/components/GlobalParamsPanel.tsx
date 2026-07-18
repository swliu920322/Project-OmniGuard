import React, { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { Network, Shield, Cpu, Lock, Globe, ListCollapse, AlertTriangle, CheckCircle } from 'lucide-react';

interface GlobalParamsPanelProps {
  // Basics
  prefix: string;
  setPrefix: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  openAiKey: string;
  setOpenAiKey: (v: string) => void;
  customResourceGroupName: string;
  setCustomResourceGroupName: (v: string) => void;
  costCenter: string;
  setCostCenter: (v: string) => void;
  finOpsOwner: string;
  setFinOpsOwner: (v: string) => void;
  
  // Security & Hosting
  deployManagedIdentities: boolean;
  setDeployManagedIdentities: (v: boolean) => void;
  deployStaticWebApp: boolean;
  setDeployStaticWebApp: (v: boolean) => void;
  
  // Networking (New)
  vnetAddressPrefix: string;
  setVnetAddressPrefix: (v: string) => void;
  backendSubnetPrefix: string;
  setBackendSubnetPrefix: (v: string) => void;
  storageSubnetPrefix: string;
  setStorageSubnetPrefix: (v: string) => void;
  
  // Validation (New)
  validationErrors: Record<string, string>;
  onManualTweak: () => void;
}

export const GlobalParamsPanel: React.FC<GlobalParamsPanelProps> = ({
  prefix,
  setPrefix,
  location,
  setLocation,
  openAiKey,
  setOpenAiKey,
  customResourceGroupName,
  setCustomResourceGroupName,
  costCenter,
  setCostCenter,
  finOpsOwner,
  setFinOpsOwner,
  deployManagedIdentities,
  setDeployManagedIdentities,
  deployStaticWebApp,
  setDeployStaticWebApp,
  vnetAddressPrefix,
  setVnetAddressPrefix,
  backendSubnetPrefix,
  setBackendSubnetPrefix,
  storageSubnetPrefix,
  setStorageSubnetPrefix,
  validationErrors,
  onManualTweak
}) => {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<'basics' | 'networking' | 'security'>('basics');

  const hasBasicsErrors = !!(validationErrors.prefix);
  const hasNetworkErrors = !!(validationErrors.vnetAddressPrefix || validationErrors.backendSubnetPrefix || validationErrors.storageSubnetPrefix || validationErrors.networkCollision);

  return (
    <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.01] pointer-events-none"></div>
      
      {/* Tabs Header */}
      <div className="flex border-b border-slate-900 pb-3 mb-6 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('basics')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all border ${
            activeTab === 'basics'
              ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/80 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <ListCollapse size={14} />
          <span>{locale === 'zh' ? '01. 基础标识 (Basics)' : '01. Basics & Identifiers'}</span>
          {hasBasicsErrors && <span className="size-1.5 bg-rose-500 rounded-full animate-ping"></span>}
        </button>

        <button
          onClick={() => setActiveTab('networking')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all border ${
            activeTab === 'networking'
              ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/80 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <Network size={14} />
          <span>{locale === 'zh' ? '02. 网络拓扑 (Networking)' : '02. Network Subnets'}</span>
          {hasNetworkErrors && <span className="size-1.5 bg-rose-500 rounded-full animate-ping"></span>}
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all border ${
            activeTab === 'security'
              ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/80 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <Shield size={14} />
          <span>{locale === 'zh' ? '03. 安全与托管 (Security)' : '03. Security & Hosting'}</span>
        </button>
      </div>

      {/* Tab 1: Basics Content */}
      {activeTab === 'basics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
          <div>
            <label className="block text-slate-300 mb-2 uppercase font-semibold text-xs tracking-wider">
              {locale === 'zh' ? '项目资源前缀 (Prefix)' : 'Resource Prefix (Prefix)'}
            </label>
            <input 
              type="text" 
              value={prefix}
              onChange={(e) => { setPrefix(e.target.value); onManualTweak(); }}
              className={`w-full h-11 px-3.5 bg-slate-950 border rounded-lg text-slate-300 focus:border-cyan-500 outline-none font-mono text-sm ${validationErrors.prefix ? 'border-rose-500 focus:border-rose-500' : 'border-slate-900'}`}
              placeholder="e.g. omni"
            />
            {validationErrors.prefix && (
              <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1"><AlertTriangle size={11} /> {validationErrors.prefix}</p>
            )}
          </div>
          <div>
            <label className="block text-slate-300 mb-2 uppercase font-semibold text-xs tracking-wider">
              {locale === 'zh' ? '自定义资源组 (Custom RG Name)' : 'Custom Resource Group (Custom RG Name)'}
            </label>
            <input 
              type="text" 
              value={customResourceGroupName}
              onChange={(e) => { setCustomResourceGroupName(e.target.value); onManualTweak(); }}
              className="w-full h-11 px-3.5 bg-slate-950 border border-slate-900 rounded-lg text-slate-300 focus:border-cyan-500 outline-none font-mono text-sm"
              placeholder={locale === 'zh' ? '留空则自动根据前缀生成' : 'Leave empty to auto-generate from prefix'}
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2 uppercase font-semibold text-xs tracking-wider">
              {locale === 'zh' ? '主部署区域 (Location)' : 'Primary Deployment Location (Location)'}
            </label>
            <select 
              value={location}
              onChange={(e) => { setLocation(e.target.value); onManualTweak(); }}
              className="w-full h-11 px-3.5 bg-slate-950 border border-slate-900 rounded-lg text-slate-300 focus:border-cyan-500 outline-none font-mono text-sm appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-[size:1.25rem_1.25rem] bg-no-repeat pr-10"
            >
              <option value="southeastasia">{locale === 'zh' ? 'southeastasia (新加坡 - 默认)' : 'southeastasia (Singapore - Default)'}</option>
              <option value="japaneast">{locale === 'zh' ? 'japaneast (日本东部)' : 'japaneast (Japan East)'}</option>
              <option value="eastasia">{locale === 'zh' ? 'eastasia (中国香港)' : 'eastasia (Hong Kong)'}</option>
              <option value="westus3">{locale === 'zh' ? 'westus3 (美国西部3)' : 'westus3 (West US 3)'}</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-300 mb-2 uppercase font-semibold text-xs tracking-wider">
              {locale === 'zh' ? 'Azure OpenAI 密钥 (API Key)' : 'Azure OpenAI / LLM Credentials (API Key)'}
            </label>
            <input 
              type="password" 
              value={openAiKey}
              onChange={(e) => { setOpenAiKey(e.target.value); onManualTweak(); }}
              className="w-full h-11 px-3.5 bg-slate-950 border border-slate-900 rounded-lg text-slate-300 focus:border-cyan-500 outline-none font-mono text-sm"
              placeholder={locale === 'zh' ? '输入密钥' : 'Enter API Key'}
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2 uppercase font-semibold text-xs tracking-wider">
              {locale === 'zh' ? '成本中心 (Cost Center)' : 'Billing Center tag (Cost Center)'}
            </label>
            <input 
              type="text" 
              value={costCenter}
              onChange={(e) => { setCostCenter(e.target.value); onManualTweak(); }}
              className="w-full h-11 px-3.5 bg-slate-950 border border-slate-900 rounded-lg text-slate-300 focus:border-cyan-500 outline-none font-mono text-sm"
              placeholder="e.g. IT-Dept"
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2 uppercase font-semibold text-xs tracking-wider">
              {locale === 'zh' ? '负责人 (FinOps Owner)' : 'FinOps Resource Owner (FinOps Owner)'}
            </label>
            <input 
              type="text" 
              value={finOpsOwner}
              onChange={(e) => { setFinOpsOwner(e.target.value); onManualTweak(); }}
              className="w-full h-11 px-3.5 bg-slate-950 border border-slate-900 rounded-lg text-slate-300 focus:border-cyan-500 outline-none font-mono text-sm"
              placeholder="e.g. Shengwei"
            />
          </div>
        </div>
      )}

      {/* Tab 2: Networking Content */}
      {activeTab === 'networking' && (
        <div className="flex flex-col gap-6 font-mono text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 mb-2 uppercase font-semibold text-xs tracking-wider">
                {locale === 'zh' ? '虚拟网络网段 (VNet CIDR)' : 'Virtual Network Segment (VNet CIDR)'}
              </label>
              <input 
                type="text" 
                value={vnetAddressPrefix}
                onChange={(e) => { setVnetAddressPrefix(e.target.value); onManualTweak(); }}
                className={`w-full h-11 px-3.5 bg-slate-950 border rounded-lg text-slate-300 focus:border-cyan-500 outline-none font-mono text-sm ${validationErrors.vnetAddressPrefix ? 'border-rose-500 focus:border-rose-500' : 'border-slate-900'}`}
                placeholder="e.g. 10.1.0.0/16"
              />
              {validationErrors.vnetAddressPrefix && (
                <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1"><AlertTriangle size={11} /> {validationErrors.vnetAddressPrefix}</p>
              )}
            </div>

            <div>
              <label className="block text-slate-300 mb-2 uppercase font-semibold text-xs tracking-wider">
                {locale === 'zh' ? '容器子网网段 (ACA Subnet)' : 'Compute Subnet Segment (ACA Subnet)'}
              </label>
              <input 
                type="text" 
                value={backendSubnetPrefix}
                onChange={(e) => { setBackendSubnetPrefix(e.target.value); onManualTweak(); }}
                className={`w-full h-11 px-3.5 bg-slate-950 border rounded-lg text-slate-300 focus:border-cyan-500 outline-none font-mono text-sm ${validationErrors.backendSubnetPrefix ? 'border-rose-500 focus:border-rose-500' : 'border-slate-900'}`}
                placeholder="e.g. 10.1.4.0/23"
              />
              {validationErrors.backendSubnetPrefix && (
                <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1"><AlertTriangle size={11} /> {validationErrors.backendSubnetPrefix}</p>
              )}
            </div>

            <div>
              <label className="block text-slate-300 mb-2 uppercase font-semibold text-xs tracking-wider">
                {locale === 'zh' ? '存储私网网段 (Storage Subnet)' : 'Database Private Subnet (Storage Subnet)'}
              </label>
              <input 
                type="text" 
                value={storageSubnetPrefix}
                onChange={(e) => { setStorageSubnetPrefix(e.target.value); onManualTweak(); }}
                className={`w-full h-11 px-3.5 bg-slate-950 border rounded-lg text-slate-300 focus:border-cyan-500 outline-none font-mono text-sm ${validationErrors.storageSubnetPrefix ? 'border-rose-500 focus:border-rose-500' : 'border-slate-900'}`}
                placeholder="e.g. 10.1.2.0/24"
              />
              {validationErrors.storageSubnetPrefix && (
                <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1"><AlertTriangle size={11} /> {validationErrors.storageSubnetPrefix}</p>
              )}
            </div>
          </div>

          {/* Network overlap / collision warning banner */}
          {validationErrors.networkCollision ? (
            <div className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/10 flex items-start gap-3 text-xs leading-relaxed text-rose-400">
              <AlertTriangle className="size-5 shrink-0 text-rose-400" />
              <div>
                <h5 className="font-bold font-sans">
                  {locale === 'zh' ? '网段冲突或划分非法 (Network Constraint Violations)' : 'Network Constraint Violations'}
                </h5>
                <p className="mt-1 font-sans text-slate-400">
                  {validationErrors.networkCollision}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-emerald-900/60 bg-emerald-950/10 flex items-start gap-3 text-xs leading-relaxed text-emerald-400">
              <CheckCircle className="size-5 shrink-0 text-emerald-400" />
              <div>
                <h5 className="font-bold font-sans">
                  {locale === 'zh' ? '网段关系正常 (Subnet Validation Passed)' : 'Subnet Layout Validation Passed'}
                </h5>
                <p className="mt-1 font-sans text-slate-400">
                  {locale === 'zh' 
                    ? `虚拟子网已完全包含在 VNet 网段（${vnetAddressPrefix}）内，且容器子网（${backendSubnetPrefix}）与存储子网（${storageSubnetPrefix}）无地址重叠冲突。`
                    : `All subnets are mathematically contained inside the VNet space (${vnetAddressPrefix}) with no overlapping IP range collisions between backend (${backendSubnetPrefix}) and storage (${storageSubnetPrefix}) ranges.`}
                </p>
              </div>
            </div>
          )}

          {/* Graphical Subnet Layout Preview */}
          <div className="p-5 rounded-xl border border-slate-900 bg-slate-950/40 font-mono text-xs">
            <h4 className="font-bold text-slate-300 mb-3 flex items-center gap-1.5 font-sans">
              <Network size={13} className="text-cyan-400" />
              <span>{locale === 'zh' ? '网络拓扑逻辑示意 (Virtual Network Architecture)' : 'Subnet Segmentation Topology'}</span>
            </h4>
            <div className="flex flex-col md:flex-row gap-4 items-stretch mt-2">
              <div className="flex-1 bg-slate-950/80 p-3 rounded-lg border border-slate-900 flex flex-col justify-center items-center text-center">
                <span className="text-slate-500 font-bold text-[10px]">VIRTUAL NETWORK (VNET)</span>
                <span className="text-cyan-400 font-bold mt-1 text-sm">{vnetAddressPrefix}</span>
              </div>
              <div className="flex flex-col justify-center items-center text-slate-600 font-bold">
                ➔
              </div>
              <div className="flex-1 bg-slate-950/80 p-3 rounded-lg border border-slate-900 flex flex-col justify-between">
                <div className="flex justify-between items-center pb-2 border-b border-slate-900/80">
                  <span className="text-slate-400 font-bold">BackendSubnet (ACA)</span>
                  <span className="text-emerald-400 font-bold font-mono">{backendSubnetPrefix}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-400 font-bold">StorageSubnet (Private)</span>
                  <span className="text-purple-400 font-bold font-mono">{storageSubnetPrefix}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Hosting Content */}
      {activeTab === 'security' && (
        <div className="flex flex-col gap-4">
          {/* Auth mode selection parameter */}
          <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans text-xs">
            <div className="flex-1">
              <h4 className="font-bold text-slate-200 flex items-center gap-1">
                <span>{locale === 'zh' ? '身份验证机制: ' : 'Authentication Mechanism: '}</span>
                <span className={deployManagedIdentities ? 'text-cyan-400' : 'text-emerald-400 font-mono'}>
                  {deployManagedIdentities 
                    ? (locale === 'zh' ? 'Managed Identity (托管身份)' : 'Managed Identity (Entra ID)') 
                    : (locale === 'zh' ? 'Classic Key Auth (降级密钥模式)' : 'Classic Key Auth (Secret-based)')}
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {locale === 'zh' 
                  ? '受限账号可切换为“经典密钥”以回避托管身份 RBAC 指派，Bicep 编译时将自动裁剪 `roleAssignments` 模块。'
                  : 'Accounts without subscription administrator permissions can switch to "Classic Key" to bypass role assignments. Bicep compiler will automatically strip the roleAssignments module.'}
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <button
                onClick={() => { setDeployManagedIdentities(false); onManualTweak(); }}
                className={`px-3 py-2 rounded-lg font-bold transition-all border ${!deployManagedIdentities ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-transparent text-slate-500 border-slate-900'}`}
              >
                {locale === 'zh' ? '经典密钥 (受限账号)' : 'Classic Key (Restricted)'}
              </button>
              <button
                onClick={() => { setDeployManagedIdentities(true); onManualTweak(); }}
                className={`px-3 py-2 rounded-lg font-bold transition-all border ${deployManagedIdentities ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-transparent text-slate-500 border-slate-900'}`}
              >
                {locale === 'zh' ? '托管身份 (云原生安全)' : 'Managed Identity (Secured)'}
              </button>
            </div>
          </div>

          {/* Frontend Hosting Mode selector */}
          <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans text-xs">
            <div className="flex-1">
              <h4 className="font-bold text-slate-200 flex items-center gap-1">
                <span>{locale === 'zh' ? '前端托管形式: ' : 'Frontend Hosting Model: '}</span>
                <span className={deployStaticWebApp ? 'text-amber-400' : 'text-cyan-400 font-mono'}>
                  {deployStaticWebApp 
                    ? (locale === 'zh' ? 'Azure Static Web App (SWA Edge)' : 'Azure Static Web App (SWA Edge)') 
                    : (locale === 'zh' ? 'Azure Container Apps (ACA Frontend)' : 'Azure Container Apps (ACA Frontend)')}
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {locale === 'zh' 
                  ? '选择容器化部署前端 Dashboard（ACA，运行在 VNet 内网，可私网隔离，按量计费），或静态 edge 托管（SWA，全球边缘加速，免费级下开销为 $0，非常适合测试和节省预算）。'
                  : 'Choose containerized hosting for the frontend dashboard (ACA, runs inside the VNet subnet, privately isolated) or static edge hosting (SWA, globally accelerated, costs $0 under free tier, best for testing).'}
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <button
                onClick={() => { setDeployStaticWebApp(false); onManualTweak(); }}
                className={`px-3 py-2 rounded-lg font-bold transition-all border ${!deployStaticWebApp ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-transparent text-slate-500 border-slate-900'}`}
              >
                {locale === 'zh' ? '容器环境 (ACA Frontend)' : 'Container App (ACA Frontend)'}
              </button>
              <button
                onClick={() => { setDeployStaticWebApp(true); onManualTweak(); }}
                className={`px-3 py-2 rounded-lg font-bold transition-all border ${deployStaticWebApp ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-transparent text-slate-500 border-slate-900'}`}
              >
                {locale === 'zh' ? '静态无服务 (SWA Edge)' : 'Static Serverless (SWA Edge)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
