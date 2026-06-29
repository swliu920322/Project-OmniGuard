export type LaunchProfileId =
  | 'local-sub-thirdparty-openai'
  | 'local-sub-azure-openai'
  | 'cloud-sub-azure-openai';

export interface LaunchProfile {
  id: LaunchProfileId;
  title: string;
  subtitle: string;
  description: string;
  subscriptionScope: 'local' | 'cloud';
  aiProvider: 'azure' | 'openai-compatible';
  scriptHint: string;
  defaultDeploymentName: string;
  defaultOpenAIModel: string;
}

export const LAUNCH_PROFILE_STORAGE_KEY = 'omniguard.launch.profile';
export const LAUNCH_CONFIG_STORAGE_KEY = 'omniguard.launch.config';

export interface LaunchConfig {
  profileId: LaunchProfileId;
  aiProvider: 'azure' | 'openai-compatible';
  azureDeploymentName: string;
  azureSubscription: string;
  azureResourceGroup: string;
  azureOpenAiAccountName: string;
}

export const LAUNCH_PROFILES: Record<LaunchProfileId, LaunchProfile> = {
  'local-sub-thirdparty-openai': {
    id: 'local-sub-thirdparty-openai',
    title: '本地订阅 + 第三方 OpenAI',
    subtitle: '推荐的解耦模式',
    description: '云底座只负责存储、计算与路由，本地订阅不再被 Azure OpenAI 绑定；LLM 调用切换到兼容 OpenAI 的第三方接口。',
    subscriptionScope: 'local',
    aiProvider: 'openai-compatible',
    scriptHint: 'AI_PROVIDER=thirdparty OPENAI_BASE_URL=https://api.openai.com/v1 OPENAI_MODEL=gpt-4o-mini ./sh/infra-up.sh',
    defaultDeploymentName: 'gpt-4o-mini',
    defaultOpenAIModel: 'gpt-4o-mini',
  },
  'local-sub-azure-openai': {
    id: 'local-sub-azure-openai',
    title: '本地订阅 + Azure OpenAI',
    subtitle: '保留 Azure 现有链路',
    description: '继续使用 Azure OpenAI，但把订阅、资源组与模型凭证全部显式参数化，避免脚本依赖单一固定订阅。',
    subscriptionScope: 'local',
    aiProvider: 'azure',
    scriptHint: 'AI_PROVIDER=azure AZURE_SUBSCRIPTION="<your-subscription>" AZURE_OPENAI_RESOURCE_GROUP="<rg>" AZURE_OPENAI_ACCOUNT_NAME="<account>" ./sh/infra-up.sh',
    defaultDeploymentName: 'gpt-4o',
    defaultOpenAIModel: 'gpt-4o-mini',
  },
  'cloud-sub-azure-openai': {
    id: 'cloud-sub-azure-openai',
    title: '云端订阅 + Azure OpenAI',
    subtitle: '全托管治理模式',
    description: '适用于需要强管控、跨订阅或生产治理的场景，脚本会先切到显式指定的订阅，再执行部署与凭证同步。',
    subscriptionScope: 'cloud',
    aiProvider: 'azure',
    scriptHint: 'AI_PROVIDER=azure AZURE_SUBSCRIPTION="<cloud-subscription>" AZURE_OPENAI_RESOURCE_GROUP="<rg>" AZURE_OPENAI_ACCOUNT_NAME="<account>" ./sh/infra-up.sh',
    defaultDeploymentName: 'gpt-4o',
    defaultOpenAIModel: 'gpt-4o-mini',
  },
};

export function loadLaunchProfile(): LaunchProfileId | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LAUNCH_PROFILE_STORAGE_KEY);
  if (!raw) return null;
  return raw in LAUNCH_PROFILES ? (raw as LaunchProfileId) : null;
}

export function saveLaunchProfile(profileId: LaunchProfileId): LaunchProfile {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAUNCH_PROFILE_STORAGE_KEY, profileId);
  }
  return LAUNCH_PROFILES[profileId];
}

export function getLaunchConfigDefaults(profileId: LaunchProfileId): LaunchConfig {
  const profile = LAUNCH_PROFILES[profileId];
  return {
    profileId,
    aiProvider: profile.aiProvider,
    azureDeploymentName: profile.defaultDeploymentName,
    azureSubscription: '',
    azureResourceGroup: '',
    azureOpenAiAccountName: '',
  };
}

export function loadLaunchConfig(): LaunchConfig {
  if (typeof window === 'undefined') {
    return getLaunchConfigDefaults('local-sub-thirdparty-openai');
  }

  const raw = window.localStorage.getItem(LAUNCH_CONFIG_STORAGE_KEY);
  if (!raw) {
    const profileId = loadLaunchProfile() || 'local-sub-thirdparty-openai';
    return getLaunchConfigDefaults(profileId);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LaunchConfig>;
    const profileId = (parsed.profileId && parsed.profileId in LAUNCH_PROFILES ? parsed.profileId : 'local-sub-thirdparty-openai') as LaunchProfileId;
    const defaults = getLaunchConfigDefaults(profileId);
    const deploymentName = parsed.azureDeploymentName && parsed.azureDeploymentName !== 'gpt-5.4-mini'
      ? parsed.azureDeploymentName
      : defaults.azureDeploymentName;
    return {
      ...defaults,
      ...parsed,
      profileId,
      aiProvider: parsed.aiProvider === 'openai-compatible' ? 'openai-compatible' : 'azure',
      azureDeploymentName: deploymentName,
    };
  } catch {
    const profileId = loadLaunchProfile() || 'local-sub-thirdparty-openai';
    return getLaunchConfigDefaults(profileId);
  }
}

export function saveLaunchConfig(config: LaunchConfig): LaunchConfig {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAUNCH_CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.localStorage.setItem(LAUNCH_PROFILE_STORAGE_KEY, config.profileId);
  }
  return config;
}

