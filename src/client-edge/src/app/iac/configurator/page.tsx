'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Coins, 
  Layers, 
  Save, 
  Terminal, 
  HelpCircle, 
  Network, 
  Zap,
  Boxes,
  Cpu,
  Lock,
  Globe,
  Gauge,
  Activity
} from 'lucide-react';

interface SkuOption {
  id: string;
  name: string;
  desc: string;
  perfSpec: string; // Performance target description
  monthlyCost: number;
  params: Record<string, any>;
}

const RESOURCES_SKU_DATA: Record<string, SkuOption[]> = {
  cosmosDb: [
    { 
      id: 'free', 
      name: 'Free Tier (免费级)', 
      desc: '单区域, 免费 1000 RU/s, 适合开发测试', 
      perfSpec: '吞吐上限 400-1000 RU/s | 无 SLA 保证',
      monthlyCost: 0,
      params: { enableCosmosFreeTier: true, cosmosThroughputAutoscale: false, cosmosThroughputMax: 400 }
    },
    { 
      id: 'autoscale-dev', 
      name: 'Autoscale Dev (开发弹性级)', 
      desc: '单区域, 动态 400-4000 RU 自动缩放, 避开 429 限流', 
      perfSpec: '弹性吞吐上限 4000 RU/s | 99.9% 可用性',
      monthlyCost: 24,
      params: { enableCosmosFreeTier: false, cosmosThroughputAutoscale: true, cosmosThroughputMax: 4000 }
    },
    { 
      id: 'enterprise-multi', 
      name: 'Enterprise Multi-Region (企业多活级)', 
      desc: '多区域同步写入, 异地读写容灾', 
      perfSpec: '双区域多写容灾 | 时延 <10ms | 99.999% SLA',
      monthlyCost: 48,
      params: { enableCosmosFreeTier: false, cosmosThroughputAutoscale: true, cosmosThroughputMax: 4000 }
    }
  ],
  apim: [
    { 
      id: 'none', 
      name: 'Bypass (不部署网关)', 
      desc: '不部署 APIM 代理, 前端直接与后端 ACA 通信', 
      perfSpec: '无网关层代理 | 外部直接暴露 API 端点',
      monthlyCost: 0,
      params: { deployApim: false, apimSku: 'None' }
    },
    { 
      id: 'developer', 
      name: 'Developer SKU (开发联调级)', 
      desc: '提供完整 VNet 挂载、SLA 限流与 JWT 校验', 
      perfSpec: '支持全功能开发调试 | 不含 SLA 容灾保障',
      monthlyCost: 147,
      params: { deployApim: true, apimSku: 'Developer' }
    },
    { 
      id: 'premium', 
      name: 'Premium SKU (企业高可用)', 
      desc: '生产级多活网关, 支持多区域部署与大规模流量吞吐', 
      perfSpec: '超大规模吞吐 | 跨地域多活 | 99.99% 可用性',
      monthlyCost: 2795,
      params: { deployApim: true, apimSku: 'Premium' }
    }
  ],
  frontDoor: [
    { 
      id: 'none', 
      name: 'None (不部署)', 
      desc: '前端直接暴露公网 ACA Ingress, 不经过 CDN 全球加速', 
      perfSpec: '区域性路由访问 | 无全球边缘加速防护',
      monthlyCost: 0,
      params: { deployFrontDoor: false, frontDoorSku: 'None' }
    },
    { 
      id: 'standard', 
      name: 'Standard SKU (标准版 CDN)', 
      desc: '全球 CDN 加速, 包含基础 WAF 过滤', 
      perfSpec: '全球边缘分发时延 <30ms | 基础 Web 过滤',
      monthlyCost: 35,
      params: { deployFrontDoor: true, frontDoorSku: 'Standard_AzureFrontDoor' }
    },
    { 
      id: 'premium', 
      name: 'Premium SKU (旗舰专线版)', 
      desc: '高级全球 WAF 规则, 机器人防护, 支持 Private Link 穿透私网', 
      perfSpec: '专线 Private Link 穿透 | 智能 WAF 防御 | 99.99% SLA',
      monthlyCost: 330,
      params: { deployFrontDoor: true, frontDoorSku: 'Premium_AzureFrontDoor' }
    }
  ],
  aca: [
    { 
      id: 'dev-sleep', 
      name: 'Dev Scale-to-Zero (自动休眠)', 
      desc: 'minReplicas=0。无流量时容器完全释放以省钱，请求时冷启动唤醒', 
      perfSpec: '低频温和响应 | 存在 2-5秒 容器冷启动时延',
      monthlyCost: 5,
      params: { acaMinReplicas: 0, acaMaxReplicas: 2 }
    },
    { 
      id: 'always-on', 
      name: 'Always-On HA (高可用常驻)', 
      desc: 'minReplicas=1。常驻热实例运行，秒级无冷启动响应，多可用区冗余', 
      perfSpec: '毫秒级即时响应 | 独占常驻内存占用 | 99.95% SLA',
      monthlyCost: 55,
      params: { acaMinReplicas: 1, acaMaxReplicas: 3 }
    }
  ],
  redis: [
    { 
      id: 'none', 
      name: 'None (无分布式缓存)', 
      desc: '不启用 Redis, 代码回退至本地进程内 MemoryCache', 
      perfSpec: '本地内存缓存 | 无分布式会话共享支持',
      monthlyCost: 0,
      params: { deployRedis: false, redisSkuName: 'None', redisSkuCapacity: 0 }
    },
    { 
      id: 'basic-c0', 
      name: 'Basic C0 (250MB 极简级)', 
      desc: '单节点无副本, 仅限非生产环境的基本缓存存取测试', 
      perfSpec: '单机内存中转 | 读写吞吐上限约 5,000 QPS | 无副本',
      monthlyCost: 16,
      params: { deployRedis: true, redisSkuName: 'Basic', redisSkuCapacity: 0 }
    },
    { 
      id: 'standard-c1', 
      name: 'Standard C1 (1GB 主备级)', 
      desc: '提供主备双副本保障, 支持自动故障转移', 
      perfSpec: '高可用主备架构 | 吞吐约 25,000 QPS | 99.9% 可用性',
      monthlyCost: 40,
      params: { deployRedis: true, redisSkuName: 'Standard', redisSkuCapacity: 1 }
    }
  ],
  search: [
    { 
      id: 'free', 
      name: 'Free Tier (免费级)', 
      desc: '限制 3 个索引、50MB 空间, 用于向量知识库或遥测搜索测试', 
      perfSpec: '索引量 <3 | 存储空间限制 50MB | 开发调试专用',
      monthlyCost: 0,
      params: { deploySearch: true, searchSkuName: 'free' }
    },
    { 
      id: 'basic', 
      name: 'Basic SKU (独立实例)', 
      desc: '提供独立搜索节点, 2GB 存储容量, 适合中小规模数据索引检索', 
      perfSpec: '独占计算实例 | 2GB 索引容量 | 99.9% SLA',
      monthlyCost: 73,
      params: { deploySearch: true, searchSkuName: 'basic' }
    }
  ],
  iotHub: [
    { 
      id: 'free-f1', 
      name: 'F1 Free (免费限制级)', 
      desc: '每日上限 8,000 条消息，超出后拦截，适合单机测试', 
      perfSpec: '每日限额 8,000 遥测消息 | 无 SLA 隔离保障',
      monthlyCost: 0,
      params: { iotHubSku: 'F1' }
    },
    { 
      id: 'standard-s1', 
      name: 'S1 Standard (标准生产级)', 
      desc: '每日上限 400,000 条消息，支持大规模设备并发遥测', 
      perfSpec: '每日 400,000 条消息并发 | 支持云端控制下发 | 99.9% SLA',
      monthlyCost: 25,
      params: { iotHubSku: 'S1' }
    }
  ]
};

interface ScenarioPreset {
  id: string;
  name: string;
  desc: string;
  deployManagedIdentities: boolean;
  deployStaticWebApp: boolean;
  skus: Record<string, string>;
  icon: React.ReactNode;
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'sandbox',
    name: '1. 极简开发沙箱 (Dev Sandbox)',
    desc: '完全移除托管身份与角色指派模块，使用经典连接串与免费层，避开学生账号权限报错，每日开销趋近于零。',
    deployManagedIdentities: false,
    deployStaticWebApp: false,
    icon: <Cpu className="text-emerald-400 size-5" />,
    skus: {
      cosmosDb: 'free',
      apim: 'none',
      frontDoor: 'none',
      aca: 'dev-sleep',
      redis: 'none',
      search: 'free',
      iotHub: 'free-f1'
    }
  },
  {
    id: 'secure-iot',
    name: '2. 内网隔离物联网 (Secure IoT Pipeline)',
    desc: '组装 Hub-Spoke VNet、Private Endpoints 与 DNS Zone 自动解析。启用托管身份与 IoT Hub DPS 零接触预配。',
    deployManagedIdentities: true,
    deployStaticWebApp: false,
    icon: <Lock className="text-cyan-400 size-5" />,
    skus: {
      cosmosDb: 'autoscale-dev',
      apim: 'none',
      frontDoor: 'none',
      aca: 'always-on',
      redis: 'none',
      search: 'free',
      iotHub: 'standard-s1'
    }
  },
  {
    id: 'global-portal',
    name: '3. 全球网关门户 (Global API Portal)',
    desc: '在场景 2 上叠加 Front Door Premium 与 APIM Developer。测试流量限流、WAF 防护与 JWT 边缘端解耦校验。',
    deployManagedIdentities: true,
    deployStaticWebApp: true,
    icon: <Globe className="text-amber-400 size-5" />,
    skus: {
      cosmosDb: 'autoscale-dev',
      apim: 'developer',
      frontDoor: 'premium',
      aca: 'always-on',
      redis: 'basic-c0',
      search: 'free',
      iotHub: 'standard-s1'
    }
  }
];

export default function BicepConfiguratorPage() {
  // Scenario selector
  const [activeScenario, setActiveScenario] = useState<string>('sandbox');

  // Configurable global params
  const [deployManagedIdentities, setDeployManagedIdentities] = useState<boolean>(false);
  const [deployStaticWebApp, setDeployStaticWebApp] = useState<boolean>(false);
  const [openAiKey, setOpenAiKey] = useState<string>('YOUR_AZURE_OPENAI_KEY');
  const [prefix, setPrefix] = useState<string>('omni');
  const [location, setLocation] = useState<string>('southeastasia');

  // Budget management state
  const [remainingBudget, setRemainingBudget] = useState<number>(196);
  const [daysRemaining, setDaysRemaining] = useState<number>(20);

  // Feature Packs (Business Capability Toggles)
  const [packZeroTrust, setPackZeroTrust] = useState<boolean>(false);
  const [packGlobalWaf, setPackGlobalWaf] = useState<boolean>(false);
  const [packScaleToZero, setPackScaleToZero] = useState<boolean>(true);
  const [packIoTDps, setPackIoTDps] = useState<boolean>(false);

  // Selected SKUs
  const [selectedSkus, setSelectedSkus] = useState<Record<string, string>>({
    cosmosDb: 'free',
    apim: 'none',
    frontDoor: 'none',
    aca: 'dev-sleep',
    redis: 'none',
    search: 'free',
    iotHub: 'free-f1'
  });

  // Apply scenario presets (updates both packs and SKUs)
  const applyPresetConfig = (presetId: string) => {
    setActiveScenario(presetId);
    if (presetId === 'sandbox') {
      setDeployManagedIdentities(false);
      setDeployStaticWebApp(false);
      setPackZeroTrust(false);
      setPackGlobalWaf(false);
      setPackScaleToZero(true);
      setPackIoTDps(false);
      setSelectedSkus({
        cosmosDb: 'free',
        apim: 'none',
        frontDoor: 'none',
        aca: 'dev-sleep',
        redis: 'none',
        search: 'free',
        iotHub: 'free-f1'
      });
    } else if (presetId === 'secure-iot') {
      setDeployManagedIdentities(true);
      setDeployStaticWebApp(false);
      setPackZeroTrust(true);
      setPackGlobalWaf(false);
      setPackScaleToZero(false);
      setPackIoTDps(true);
      setSelectedSkus({
        cosmosDb: 'autoscale-dev',
        apim: 'none',
        frontDoor: 'none',
        aca: 'always-on',
        redis: 'none',
        search: 'free',
        iotHub: 'standard-s1'
      });
    } else if (presetId === 'global-portal') {
      setDeployManagedIdentities(true);
      setDeployStaticWebApp(true);
      setPackZeroTrust(true);
      setPackGlobalWaf(true);
      setPackScaleToZero(false);
      setPackIoTDps(true);
      setSelectedSkus({
        cosmosDb: 'autoscale-dev',
        apim: 'developer',
        frontDoor: 'premium',
        aca: 'always-on',
        redis: 'basic-c0',
        search: 'free',
        iotHub: 'standard-s1'
      });
    }
  };

  // Sync toggles when Feature Packs are checked (Simplified Mode)
  useEffect(() => {
    if (activeScenario === 'custom') return; // let user adjust freely in custom mode
  }, []);

  const handleTogglePack = (packType: string, val: boolean) => {
    setActiveScenario('custom'); // Any change in packs sets status to custom adjustments
    if (packType === 'zeroTrust') {
      setPackZeroTrust(val);
      setDeployManagedIdentities(val);
      setSelectedSkus(prev => ({
        ...prev,
        cosmosDb: val ? 'autoscale-dev' : 'free'
      }));
    } else if (packType === 'globalWaf') {
      setPackGlobalWaf(val);
      setSelectedSkus(prev => ({
        ...prev,
        frontDoor: val ? 'premium' : 'none',
        apim: val ? 'developer' : 'none'
      }));
    } else if (packType === 'scaleToZero') {
      setPackScaleToZero(val);
      setSelectedSkus(prev => ({
        ...prev,
        aca: val ? 'dev-sleep' : 'always-on'
      }));
    } else if (packType === 'ioTDps') {
      setPackIoTDps(val);
      setSelectedSkus(prev => ({
        ...prev,
        iotHub: val ? 'standard-s1' : 'free-f1'
      }));
    }
  };

  // Manual SKU Override (from Advanced settings)
  const handleSelectSku = (resType: string, optionId: string) => {
    setActiveScenario('custom');
    setSelectedSkus(prev => ({ ...prev, [resType]: optionId }));
    
    // Check if change impacts current pack toggles visually
    if (resType === 'aca') {
      setPackScaleToZero(optionId === 'dev-sleep');
    } else if (resType === 'frontDoor' || resType === 'apim') {
      // If disabled global routing, turn off global packet toggle
      if (optionId === 'none') {
        setPackGlobalWaf(false);
      }
    } else if (resType === 'iotHub') {
      setPackIoTDps(optionId === 'standard-s1');
    }
  };

  // UI state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [assemblerConsole, setAssemblerConsole] = useState<string | null>(null);

  // Calculations
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [dailyTotal, setDailyTotal] = useState<number>(0);
  const [projectedCost, setProjectedCost] = useState<number>(0);
  const [isBudgetSafe, setIsBudgetSafe] = useState<boolean>(true);
  const [perfRating, setPerfRating] = useState<{ grade: string; color: string; desc: string }>({ grade: 'C', color: 'text-emerald-400', desc: '沙箱PoC环境' });

  useEffect(() => {
    let monthly = 0;
    Object.entries(selectedSkus).forEach(([resType, optionId]) => {
      const option = RESOURCES_SKU_DATA[resType]?.find(opt => opt.id === optionId);
      if (option) {
        if (resType === 'aca' && deployStaticWebApp) {
          monthly += option.monthlyCost * 0.6; // SWA offset
        } else {
          monthly += option.monthlyCost;
        }
      }
    });

    const daily = monthly / 30;
    const projected = daily * daysRemaining;

    setMonthlyTotal(monthly);
    setDailyTotal(daily);
    setProjectedCost(projected);
    setIsBudgetSafe(projected <= remainingBudget);

    // Compute Performance Rating Tier based on architectural layout
    let points = 0;
    if (deployManagedIdentities) points += 20; // Secure IAM
    if (selectedSkus.cosmosDb !== 'free') points += 15; // Production DB
    if (selectedSkus.apim !== 'none') points += 15; // Gateway protection
    if (selectedSkus.frontDoor === 'premium') points += 20; // Edge Private Link + WAF
    if (selectedSkus.aca === 'always-on') points += 15; // HA instance
    if (selectedSkus.iotHub === 'standard-s1') points += 15; // Dedicated IoT ingestion

    if (points >= 80) {
      setPerfRating({ grade: 'Class S (极速高容灾)', color: 'text-amber-400', desc: '生产级高可用：身网双锁、边缘全球分发与高可用计算常驻' });
    } else if (points >= 40) {
      setPerfRating({ grade: 'Class A (安全可扩展)', color: 'text-cyan-400', desc: '企业开发级：提供网络专线和托管身份认证，支持异步遥测接入' });
    } else {
      setPerfRating({ grade: 'Class C (低耗开发沙箱)', color: 'text-emerald-400', desc: '极简测试级：无特权需求，按量计费，随用随停' });
    }

  }, [selectedSkus, daysRemaining, remainingBudget, deployStaticWebApp, deployManagedIdentities]);

  const generateParametersObj = () => {
    const params: Record<string, any> = {
      location: location,
      prefix: prefix,
      openAiKey: openAiKey,
      deployManagedIdentities: deployManagedIdentities,
      deployStaticWebApp: deployStaticWebApp
    };

    Object.entries(selectedSkus).forEach(([resType, optionId]) => {
      const option = RESOURCES_SKU_DATA[resType]?.find(opt => opt.id === optionId);
      if (option && option.params) {
        Object.assign(params, option.params);
      }
    });

    return params;
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setAssemblerConsole(null);

    const configPayload = {
      uiState: {
        activeScenario,
        selectedSkus,
        deployManagedIdentities,
        deployStaticWebApp,
        prefix,
        location,
        remainingBudget,
        daysRemaining
      },
      parameters: generateParametersObj()
    };

    try {
      const response = await fetch('/api/save-iac-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configPayload)
      });

      const result = await response.json();

      if (response.ok) {
        setSaveMessage({
          type: 'success',
          text: result.message
        });
        setAssemblerConsole(result.output);
      } else {
        setAssemblerConsole(result.output || '未知编译预检错误');
        throw new Error(result.message || result.error || '场景编译失败');
      }
    } catch (err: any) {
      setSaveMessage({
        type: 'error',
        text: `场景物化组装失败: ${err.message}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  const parametersObj = generateParametersObj();
  const parametersJsonString = JSON.stringify({
    $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
    contentVersion: '1.0.0.0',
    parameters: Object.entries(parametersObj).reduce((acc: any, [key, val]) => {
      acc[key] = { value: val };
      return acc;
    }, {})
  }, null, 2);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12 selection:bg-cyan-500 selection:text-slate-900">
      
      {/* Page Header */}
      <div className="max-w-7xl mx-auto mb-8 border-b border-slate-900 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-1 flex items-center gap-1.5">
            <Zap size={13} className="animate-pulse" /> SCENARIO_INTEGRATION_DASHBOARD
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            云原生基于场景的集成拓扑配置台
          </h1>
          <p className="text-sm text-slate-400 font-mono mt-1 leading-relaxed">
            融合功能视角与规格细节的“双维度控制台”：左侧按功能包一键配置业务指标，右侧实时测算性能水位与成本阻尼。
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/iac" className="text-xs font-mono border border-slate-800 bg-slate-900/60 hover:border-cyan-500 px-4 py-2 rounded-lg text-slate-300 transition-all shadow-xl">
            ➔ 返回方案大厅
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Configurator Options */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Section 1: Scenario Presets Selector */}
          <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.02] pointer-events-none"></div>
            <h2 className="text-xs font-bold font-mono text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-900 pb-2 uppercase tracking-wider">
              <Boxes size={15} className="text-cyan-400" />
              <span>选择集成主预设 (Choose Core Presets)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SCENARIO_PRESETS.map((preset) => {
                const isActive = activeScenario === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPresetConfig(preset.id)}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 ${
                      isActive 
                        ? 'bg-cyan-950/20 border-cyan-500/80 shadow-[0_0_20px_rgba(0,242,254,0.03)]' 
                        : 'bg-slate-950/30 border-slate-900 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded border ${isActive ? 'bg-cyan-950/40 border-cyan-800' : 'bg-slate-950 border-slate-900'}`}>
                        {preset.icon}
                      </div>
                      <span className={`text-xs font-bold font-mono ${isActive ? 'text-cyan-400' : 'text-slate-300'}`}>
                        {preset.name.split(' ')[1]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans min-h-12">
                      {preset.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Business Feature Packs (Capability Toggles) */}
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
                    onChange={(e) => handleTogglePack('zeroTrust', e.target.checked)}
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
                    onChange={(e) => handleTogglePack('globalWaf', e.target.checked)}
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
                    onChange={(e) => handleTogglePack('scaleToZero', e.target.checked)}
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
                    onChange={(e) => handleTogglePack('ioTDps', e.target.checked)}
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

          {/* Section 3: Global Variables Setup */}
          <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative">
            <h2 className="text-xs font-bold font-mono text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-900 pb-2 uppercase tracking-wider">
              <Network size={15} className="text-cyan-400" />
              <span>全局基础变量与托管身份机制 (Variables & Credentials Mode)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-sm mb-6">
              <div>
                <label className="block text-slate-300 mb-2 uppercase font-semibold">项目资源前缀</label>
                <input 
                  type="text" 
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-300 focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2 uppercase font-semibold">主部署区域</label>
                <select 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-300 focus:border-cyan-500 outline-none"
                >
                  <option value="southeastasia">southeastasia (新加坡)</option>
                  <option value="japaneast">japaneast (日本东部)</option>
                  <option value="eastasia">eastasia (中国香港)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-2 uppercase font-semibold">Azure OpenAI 密钥</label>
                <input 
                  type="password" 
                  value={openAiKey}
                  onChange={(e) => setOpenAiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-300 focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* Auth mode selection parameter */}
            <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans text-xs">
              <div className="flex-1">
                <h4 className="font-bold text-slate-200 flex items-center gap-1">
                  <span>身份验证机制: </span>
                  <span className={deployManagedIdentities ? 'text-cyan-400' : 'text-emerald-400 font-mono'}>
                    {deployManagedIdentities ? 'Managed Identity (托管身份)' : 'Classic Key Auth (降级密钥模式)'}
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed font-sans">
                  受限账号可切换为“经典密钥”以回避托管身份 RBAC 指派，Bicep 编译时将自动裁剪 `roleAssignments` 模块。
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <button
                  onClick={() => { setDeployManagedIdentities(false); setActiveScenario('custom'); }}
                  className={`px-3 py-2 rounded-lg font-bold transition-all border ${!deployManagedIdentities ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-transparent text-slate-500 border-slate-900'}`}
                >
                  经典密钥 (受限账号)
                </button>
                <button
                  onClick={() => { setDeployManagedIdentities(true); setActiveScenario('custom'); }}
                  className={`px-3 py-2 rounded-lg font-bold transition-all border ${deployManagedIdentities ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-transparent text-slate-500 border-slate-900'}`}
                >
                  托管身份 (云原生安全)
                </button>
              </div>
            </div>

            {/* Frontend Hosting Mode selector */}
            <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans text-xs mt-4">
              <div className="flex-1">
                <h4 className="font-bold text-slate-200 flex items-center gap-1">
                  <span>前端托管形式: </span>
                  <span className={deployStaticWebApp ? 'text-amber-400' : 'text-cyan-400 font-mono'}>
                    {deployStaticWebApp ? 'Azure Static Web App (SWA Edge)' : 'Azure Container Apps (ACA Frontend)'}
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed font-sans">
                  选择容器化部署前端 Dashboard（ACA，运行在 VNet 内网，可私网隔离，按量计费），或静态 edge 托管（SWA，全球边缘加速，免费级下开销为 $0，非常适合测试和节省预算）。
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <button
                  onClick={() => { setDeployStaticWebApp(false); setActiveScenario('custom'); }}
                  className={`px-3 py-2 rounded-lg font-bold transition-all border ${!deployStaticWebApp ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-transparent text-slate-500 border-slate-900'}`}
                >
                  容器环境 (ACA Frontend)
                </button>
                <button
                  onClick={() => { setDeployStaticWebApp(true); setActiveScenario('custom'); }}
                  className={`px-3 py-2 rounded-lg font-bold transition-all border ${deployStaticWebApp ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-transparent text-slate-500 border-slate-900'}`}
                >
                  静态无服务 (SWA Edge)
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Advanced Options Accordion */}
          <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative">
            <h2 className="text-xs font-bold font-mono text-slate-400 mb-6 flex items-center justify-between border-b border-slate-900 pb-2 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-cyan-400" />
                <span>架构师精细微调规格 (Architect SKU Spec Tuning)</span>
              </div>
              {activeScenario !== 'custom' && (
                <span className="text-xs font-mono text-slate-400 tracking-wider bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  当前预设: {activeScenario}
                </span>
              )}
            </h2>

            <div className="flex flex-col gap-6">
              {Object.entries(RESOURCES_SKU_DATA).map(([resType, options]) => {
                const currentSelection = selectedSkus[resType];
                const labelMap: Record<string, string> = {
                  cosmosDb: '持久化数据层 (Azure Cosmos DB)',
                  apim: 'API 管理网关 (API Management)',
                  frontDoor: '全球边缘边界 (Azure Front Door)',
                  aca: '计算容器平台 (Container Apps)',
                  redis: '会话缓存层 (Azure Cache for Redis)',
                  search: '全文向量检索 (Azure AI Search)',
                  iotHub: '神经丛入口 (IoT Hub)'
                };

                return (
                  <div key={resType} className="border-b border-slate-900/60 pb-5 last:border-b-0 last:pb-0">
                    <h3 className="text-xs font-bold font-mono text-cyan-400 mb-3">{labelMap[resType]}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {options.map((opt) => {
                        const isSelected = currentSelection === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleSelectSku(resType, opt.id)}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 ${
                              isSelected 
                                ? 'bg-cyan-950/20 border-cyan-500/80 shadow-[0_0_15px_rgba(0,242,254,0.03)]' 
                                : 'bg-slate-950/40 border-slate-900 hover:border-slate-800 text-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-[11px] font-bold font-mono ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>
                                {opt.name}
                              </span>
                              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded">
                                {opt.monthlyCost === 0 ? '免费' : `$${opt.monthlyCost}/月`}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed mt-2 text-slate-400">
                              {opt.desc}
                            </p>
                            <div className="mt-2.5 pt-2 border-t border-slate-900/60 text-xs font-mono text-slate-300 bg-[#060b13] p-1.5 rounded">
                              🔒 <b>性能标的:</b> {opt.perfSpec}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Cost and Deployment Trigger */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Budget status box */}
          <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative flex flex-col gap-5">
            <h2 className="text-xs font-bold font-mono text-slate-400 border-b border-slate-900 pb-2 flex items-center gap-2 uppercase tracking-wider">
              <Coins size={15} className="text-cyan-400" />
              <span>03. 账单测算与架构评级</span>
            </h2>

            {/* Configurable subscription info */}
            <div className="grid grid-cols-2 gap-4 font-mono text-xs border-b border-slate-900 pb-4">
              <div>
                <label className="block text-slate-450 mb-1 uppercase font-semibold">当前订阅余额 (USD)</label>
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

            {/* Save trigger button */}
            <button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-cyan-950/30 disabled:opacity-50"
            >
              <Save size={14} />
              <span>{isSaving ? '正在动态编译拓扑...' : '一键生成拓扑并验证 .azure/'}</span>
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

          {/* Deployment Quick commands */}
          <div className="bg-[#0b101d]/60 border border-slate-900 rounded-2xl p-6 shadow-2xl relative flex flex-col gap-4 font-mono text-[11px]">
            <h2 className="text-sm font-bold text-slate-200 border-b border-slate-900 pb-2 flex items-center gap-2 font-sans">
              <Terminal size={14} className="text-cyan-400" />
              <span>05. 一键终端部署指令</span>
            </h2>
            <p className="text-slate-400 font-sans text-sm">
              保存参数后，直接打开本地终端执行以下指令，即可以该规格完成自动化物理部署：
            </p>
            <div className="bg-slate-950 border border-slate-900 p-3 rounded-xl text-emerald-400 relative overflow-hidden select-text">
              <pre className="whitespace-pre-wrap leading-relaxed">
{`# 1. 登录云账号
az login

# 2. 注入参数执行订阅级一键组装部署
az deployment sub create \\
  --location ${location} \\
  --template-file .azure/main.bicep \\
  --parameters .azure/main.parameters.json`}
              </pre>
            </div>
            <div className="text-xs text-slate-400 font-sans italic flex items-center gap-1">
              <HelpCircle size={12} /> 提示：本地 parameters 格式已完成自愈适配，一键复制即可运行。
            </div>
          </div>

        </div>

      </div>

      {/* Live Console Output Log */}
      {assemblerConsole && (
        <div className="max-w-7xl mx-auto mt-8 bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-2xl relative font-mono text-xs">
          <h3 className="text-slate-400 mb-3 border-b border-slate-900/60 pb-2 flex items-center gap-2">
            <Terminal size={13} className="text-cyan-400 animate-pulse" />
            <span>COMPILER_CONSOLE_OUTPUT (编译与自愈防御日志)</span>
          </h3>
          <div className="bg-[#030712] p-4 rounded-xl border border-slate-900/60 text-slate-300 select-text max-h-80 overflow-y-auto font-mono leading-relaxed whitespace-pre font-bold">
            {assemblerConsole}
          </div>
        </div>
      )}

      {/* JSON Preview window at the bottom */}
      <div className="max-w-7xl mx-auto mt-8 bg-[#070b15] border border-slate-900 rounded-2xl p-6 shadow-2xl relative font-mono text-xs">
        <h3 className="text-slate-400 mb-3 border-b border-slate-900 pb-2 flex items-center gap-1.5">
          <Terminal size={12} className="text-cyan-400" />
          <span>PREVIEW: .azure/main.parameters.json (自愈生成参数)</span>
        </h3>
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 overflow-x-auto text-cyan-500 select-text max-h-60 overflow-y-auto">
          <pre>{parametersJsonString}</pre>
        </div>
      </div>

    </main>
  );
}
