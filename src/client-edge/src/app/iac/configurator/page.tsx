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

import { GlobalParamsPanel } from './components/GlobalParamsPanel';
import { FeaturePacksSelector } from './components/FeaturePacksSelector';
import { SkuTuningSection } from './components/SkuTuningSection';
import { CostCalculatorPanel } from './components/CostCalculatorPanel';
import { ConsoleOutputPanel } from './components/ConsoleOutputPanel';


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
  const [customResourceGroupName, setCustomResourceGroupName] = useState<string>('');
  const [costCenter, setCostCenter] = useState<string>('IT-Dept');
  const [finOpsOwner, setFinOpsOwner] = useState<string>('Shengwei');

  // New Network Prefix States
  const [vnetAddressPrefix, setVnetAddressPrefix] = useState<string>('10.1.0.0/16');
  const [backendSubnetPrefix, setBackendSubnetPrefix] = useState<string>('10.1.4.0/23');
  const [storageSubnetPrefix, setStorageSubnetPrefix] = useState<string>('10.1.2.0/24');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Network Validation Hook
  useEffect(() => {
    const errors: Record<string, string> = {};

    // 1. Prefix simple check
    if (!prefix || prefix.length < 2 || prefix.length > 8) {
      errors.prefix = '前缀长度需在 2 到 8 个字符之间';
    } else if (!/^[a-z0-9]+$/.test(prefix)) {
      errors.prefix = '前缀仅能包含小写字母与数字';
    }

    // Helpers
    const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;
    const parseCidr = (cidr: string) => {
      if (!cidrRegex.test(cidr)) return null;
      const parts = cidr.split('/');
      const ip = parts[0];
      const mask = parseInt(parts[1], 10);
      const ipParts = ip.split('.').map(x => parseInt(x, 10));
      if (ipParts.some(x => x > 255)) return null;
      const start = ipParts[0] * 16777216 + ipParts[1] * 65536 + ipParts[2] * 256 + ipParts[3];
      const end = start + Math.pow(2, 32 - mask) - 1;
      return { start, end, mask };
    };

    // Parse CIDRs
    const vnet = parseCidr(vnetAddressPrefix);
    const backend = parseCidr(backendSubnetPrefix);
    const storage = parseCidr(storageSubnetPrefix);

    if (!vnet) {
      errors.vnetAddressPrefix = 'VNet CIDR 格式不正确，例如 10.1.0.0/16';
    }
    if (!backend) {
      errors.backendSubnetPrefix = '容器子网 CIDR 格式不正确，例如 10.1.4.0/23';
    } else if (backend.mask > 23) {
      errors.backendSubnetPrefix = '容器子网掩码长度必须 <= 23（即子网至少包含 512 个 IP），否则 ACA 部署将拒绝';
    }
    if (!storage) {
      errors.storageSubnetPrefix = '存储子网 CIDR 格式不正确，例如 10.1.2.0/24';
    }

    // Containment & Collision logic
    if (vnet && backend && storage) {
      const isBackendInVnet = backend.start >= vnet.start && backend.end <= vnet.end;
      const isStorageInVnet = storage.start >= vnet.start && storage.end <= vnet.end;
      const isOverlap = (backend.start <= storage.end) && (storage.start <= backend.end);

      if (!isBackendInVnet) {
        errors.networkCollision = `容器子网 (${backendSubnetPrefix}) 必须完全包含在 VNet (${vnetAddressPrefix}) 的地址空间范围内。`;
      } else if (!isStorageInVnet) {
        errors.networkCollision = `存储子网 (${storageSubnetPrefix}) 必须完全包含在 VNet (${vnetAddressPrefix}) 的地址空间范围内。`;
      } else if (isOverlap) {
        errors.networkCollision = `网络分配重叠：容器子网 (${backendSubnetPrefix}) 与存储子网 (${storageSubnetPrefix}) 的 IP 地址段存在重合冲突！`;
      }
    }

    setValidationErrors(errors);
  }, [prefix, vnetAddressPrefix, backendSubnetPrefix, storageSubnetPrefix]);



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

  // Hydrate saved config state from server on mount
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const res = await fetch('/api/save-iac-config');
        if (res.ok) {
          const data = await res.json();
          if (data.uiState) {
            const state = data.uiState;
            if (state.activeScenario) setActiveScenario(state.activeScenario);
            if (state.prefix) setPrefix(state.prefix);
            if (state.location) setLocation(state.location);
            if (state.customResourceGroupName !== undefined) setCustomResourceGroupName(state.customResourceGroupName);
            if (state.costCenter) setCostCenter(state.costCenter);
            if (state.finOpsOwner) setFinOpsOwner(state.finOpsOwner);
            if (state.deployManagedIdentities !== undefined) setDeployManagedIdentities(state.deployManagedIdentities);
            if (state.deployStaticWebApp !== undefined) setDeployStaticWebApp(state.deployStaticWebApp);
            if (state.vnetAddressPrefix) setVnetAddressPrefix(state.vnetAddressPrefix);
            if (state.backendSubnetPrefix) setBackendSubnetPrefix(state.backendSubnetPrefix);
            if (state.storageSubnetPrefix) setStorageSubnetPrefix(state.storageSubnetPrefix);
            if (state.selectedSkus) setSelectedSkus(state.selectedSkus);
            
            // Infer feature packs
            setPackZeroTrust(state.deployManagedIdentities);
            setPackGlobalWaf(state.selectedSkus.frontDoor === 'premium');
            setPackScaleToZero(state.selectedSkus.aca === 'dev-sleep');
            setPackIoTDps(state.selectedSkus.iotHub === 'standard-s1');
          }
        }
      } catch (err) {
        console.warn('Failed to load saved configuration state:', err);
      }
    };
    loadSavedConfig();
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
  const [isValidatingCloud, setIsValidatingCloud] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [assemblerConsole, setAssemblerConsole] = useState<string | null>(null);

  // Calculations
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [dailyTotal, setDailyTotal] = useState<number>(0);
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

    setMonthlyTotal(monthly);
    setDailyTotal(daily);

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

  }, [selectedSkus, deployStaticWebApp, deployManagedIdentities]);

  const handleDownloadPackage = () => {
    window.open('/api/download-iac', '_blank');
  };

  const generateParametersObj = () => {
    const params: Record<string, any> = {
      location: location,
      prefix: prefix,
      openAiKey: openAiKey,
      openAiDeploymentName: 'gpt-5.4-mini',
      deployStaticWebApp: deployStaticWebApp,
      customResourceGroupName: customResourceGroupName,
      vnetAddressPrefix: vnetAddressPrefix,
      backendSubnetPrefix: backendSubnetPrefix,
      storageSubnetPrefix: storageSubnetPrefix,
      costCenter: costCenter,
      finOpsOwner: finOpsOwner
    };

    return params;
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setAssemblerConsole(null);

    // Intercept saving if there are validation errors
    if (Object.keys(validationErrors).length > 0) {
      setSaveMessage({
        type: 'error',
        text: '保存已拦截：请先在“02. 网络拓扑”或“01. 基础标识”标签页中修正配置错误！'
      });
      setIsSaving(false);
      return;
    }

    const configPayload = {
      uiState: {
        activeScenario,
        selectedSkus,
        deployManagedIdentities,
        deployStaticWebApp,
        prefix,
        location,
        customResourceGroupName,
        costCenter,
        finOpsOwner,
        vnetAddressPrefix,
        backendSubnetPrefix,
        storageSubnetPrefix
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

  const handlePreflightValidate = async () => {
    setIsValidatingCloud(true);
    setSaveMessage(null);
    setAssemblerConsole('[*] Connecting to Azure API... Submitting validation parameters to subscription...\n');

    try {
      const response = await fetch('/api/save-iac-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preflight' })
      });

      const result = await response.json();

      if (response.ok) {
        setAssemblerConsole(result.output || result.message);
        setSaveMessage({ type: 'success', text: '云端预飞行校验成功通过，网段与权限 100% 兼容！' });
      } else {
        setAssemblerConsole(result.output || result.message);
        setSaveMessage({ type: 'error', text: '云端预飞行校验失败，请检查控制台日志。' });
      }
    } catch (err: any) {
      setAssemblerConsole(`[!] 网络请求异常: ${err.message}`);
      setSaveMessage({ type: 'error', text: '云端预检请求失败，请检查网络连接。' });
    } finally {
      setIsValidatingCloud(false);
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
          <FeaturePacksSelector
            packZeroTrust={packZeroTrust}
            packGlobalWaf={packGlobalWaf}
            packScaleToZero={packScaleToZero}
            packIoTDps={packIoTDps}
            onTogglePack={handleTogglePack}
          />

          {/* Section 3: Global Variables Setup */}
          <GlobalParamsPanel
            prefix={prefix}
            setPrefix={setPrefix}
            location={location}
            setLocation={setLocation}
            openAiKey={openAiKey}
            setOpenAiKey={setOpenAiKey}
            customResourceGroupName={customResourceGroupName}
            setCustomResourceGroupName={setCustomResourceGroupName}
            costCenter={costCenter}
            setCostCenter={setCostCenter}
            finOpsOwner={finOpsOwner}
            setFinOpsOwner={setFinOpsOwner}
            deployManagedIdentities={deployManagedIdentities}
            setDeployManagedIdentities={setDeployManagedIdentities}
            deployStaticWebApp={deployStaticWebApp}
            setDeployStaticWebApp={setDeployStaticWebApp}
            vnetAddressPrefix={vnetAddressPrefix}
            setVnetAddressPrefix={setVnetAddressPrefix}
            backendSubnetPrefix={backendSubnetPrefix}
            setBackendSubnetPrefix={setBackendSubnetPrefix}
            storageSubnetPrefix={storageSubnetPrefix}
            setStorageSubnetPrefix={setStorageSubnetPrefix}
            validationErrors={validationErrors}
            onManualTweak={() => setActiveScenario('custom')}
          />

          {/* Section 4: Advanced Options Accordion */}
          <SkuTuningSection
            selectedSkus={selectedSkus}
            onSelectSku={handleSelectSku}
            skuData={RESOURCES_SKU_DATA}
            activeScenario={activeScenario}
          />
        </div>

        {/* Right Column: Cost and Deployment Trigger */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <CostCalculatorPanel
            monthlyTotal={monthlyTotal}
            dailyTotal={dailyTotal}
            perfRating={perfRating}
            isSaving={isSaving}
            isValidatingCloud={isValidatingCloud}
            saveMessage={saveMessage}
            onSaveConfig={handleSaveConfig}
            onPreflightValidate={handlePreflightValidate}
            onDownloadPackage={handleDownloadPackage}
          />

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
      <ConsoleOutputPanel assemblerConsole={assemblerConsole} />

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
