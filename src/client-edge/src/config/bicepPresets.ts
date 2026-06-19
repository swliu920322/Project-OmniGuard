export interface BicepPresetWorkspace {
  name: string;
  description: string;
  coverImg?: string;
  files: Record<string, string>;
}

// 🟩 刚性锁定：每次模块热引导时完全洗净
export const BICEP_ARCH_PRESETS: Record<string, BicepPresetWorkspace> = {};

try {
  const bicepContext = require.context('@/presets', true, /\.bicep$/);
  const jsonContext = require.context('@/presets', true, /metadata\.json$/);
  const imgContext = require.context('@/presets', true, /cover\.(png|jpg|jpeg|img)$/);

  // 🎯 【核心绝杀】：用正则表达式无视前缀，强行捞出 presets/ 紧跟的真实文件夹名
  const extractPresetKey = (webpackKey: string): string | null => {
    // 匹配 presets/后面、且不包含斜杠的第一个目录段
    const match = webpackKey.match(/(?:presets\/|^\.\/)([^/]+)/);
    if (match && match[1] !== 'presets' && !match[1].startsWith('.')) {
      return match[1];
    }
    return null;
  };

  // 🔍 🏁 阶段一：逆向路径溯源，提取真实的【唯一方案文件夹集合】
  const presetFolderSet = new Set<string>();
  const allContextKeys = [...bicepContext.keys(), ...jsonContext.keys(), ...imgContext.keys()];

  allContextKeys.forEach((key) => {
    const folderName = extractPresetKey(key);
    if (folderName) {
      presetFolderSet.add(folderName);
    }
  });

  // 🔍 🏁 阶段二：以精准提取的文件夹为唯一主键，执行多文件合拢
  presetFolderSet.forEach((folderName) => {
    const workspaceFiles: Record<string, string> = {};
    let workspaceName = folderName;
    let workspaceDesc = '全自动编译拉起的分布式多文件 IaC 拓扑方案。';
    let workspaceCover: string | undefined = undefined;

    // 1. 倒灌属于当前文件夹下的所有多个 .bicep 文件
    bicepContext.keys().forEach((key) => {
      if (extractPresetKey(key) === folderName) {
        // 清洗出纯净的 VFS 相对路径指针 (确保在详情页里树状层级对账正确)
        const parts = key.split('/');
        const relativeIdx = parts.indexOf(folderName);
        const relativeBicepPath = parts.slice(relativeIdx + 1).join('/');

        const cleanVFSKey = key.endsWith('main.bicep') ? 'main.bicep' : `./${relativeBicepPath}`;
        workspaceFiles[cleanVFSKey] = bicepContext(key);
      }
    });

    if (Object.keys(workspaceFiles).length === 0) return;

    // 2. 倒灌说明书
    jsonContext.keys().forEach((key) => {
      if (extractPresetKey(key) === folderName) {
        try {
          const metadata = jsonContext(key);
          if (metadata.name) workspaceName = metadata.name;
          if (metadata.description) workspaceDesc = metadata.description;
        } catch (e) {}
      }
    });

    // 3. 倒灌封面图
    imgContext.keys().forEach((key) => {
      if (extractPresetKey(key) === folderName) {
        workspaceCover = imgContext(key).default || imgContext(key);
      }
    });

    // 单次刚性写入大厅账本
    BICEP_ARCH_PRESETS[folderName] = {
      name: workspaceName,
      description: workspaceDesc,
      coverImg: workspaceCover,
      files: workspaceFiles
    };
  });

} catch (error) {
  console.error("[Asset Matrix Compiler Fatal] 方案文件夹流编排引擎断层: ", error);
}