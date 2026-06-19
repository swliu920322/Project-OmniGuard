import { Node, Edge } from '@xyflow/react';

export function parseBicepToElements(bicepText: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // 1. 🔍 【第一阶段】：符号字典扫描雷达 (Symbol Table Extraction)
  // 匹配隐式资源符号: resource <symbolicName> '<provider>'
  const resourceRegex = /resource\s+(\w+)\s+'([^']+)'/g;
  // 匹配架构模块符号: module <symbolicName> '<path>'
  const moduleRegex = /module\s+(\w+)\s+'([^']+)'/g;

  interface BicepEntity {
    name: string;
    type: 'resource' | 'module';
    providerOrPath: string;
    body: string;
  }

  const entityRegistry: BicepEntity[] = [];
  const symbolNames: string[] = []; // 全局物理符号表

  // 提取资源块文本腹地
  const lines = bicepText.split('\n');

  // 极简文本分块器（利用大括号平衡原理捕获完整 Block）
  function extractBlocks() {
    let currentEntity: BicepEntity | null = null;
    let braceCount = 0;
    let bodyBuffer = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!currentEntity) {
        // 探测资源
        const resMatch = /resource\s+(\w+)\s+'([^']+)'/.exec(line);
        if (resMatch) {
          currentEntity = { name: resMatch[1], type: 'resource', providerOrPath: resMatch[2].split('@')[0], body: '' };
          symbolNames.push(resMatch[1]);
          bodyBuffer = '';
          braceCount = 0;
        }
        // 探测模块
        const modMatch = /module\s+(\w+)\s+'([^']+)'/.exec(line);
        if (modMatch) {
          currentEntity = { name: modMatch[1], type: 'module', providerOrPath: modMatch[2], body: '' };
          symbolNames.push(modMatch[1]);
          bodyBuffer = '';
          braceCount = 0;
        }
      }

      if (currentEntity) {
        bodyBuffer += line + '\n';
        if (line.includes('{')) braceCount += (line.match(/{/g) || []).length;
        if (line.includes('}')) braceCount -= (line.match(/}/g) || []).length;

        if (braceCount === 0 && bodyBuffer.includes('{')) {
          currentEntity.body = bodyBuffer;
          entityRegistry.push(currentEntity);
          currentEntity = null;
        }
      }
    }
  }

  extractBlocks();

  // 2. 🔍 【第二阶段】：层级矩阵编排与物理定位
  let xOffset = 0;
  entityRegistry.forEach((entity) => {
    const isModule = entity.type === 'module'; 

    // 刚性纵向分层轴线 (Layered Axis)
    let yPos = 300; // 默认层（计算与宿主层）
    let borderStroke = '#10b981'; // 资源绿
    let labelColor = 'text-emerald-400';

    if (entity.providerOrPath.includes('virtualNetworks')) {
      yPos = 50; // 顶层：网络网络安全边界
      borderStroke = '#00f2fe';
      labelColor = 'text-cyan-400';
    } else if (entity.providerOrPath.includes('storageAccounts')) {
      yPos = 550; // 底层：数据资产与持久化分类
      borderStroke = '#f59e0b';
      labelColor = 'text-amber-400';
    } else if (isModule) {
      yPos = 320; // 核心：高阶模块容器
      borderStroke = '#a855f7'; // 模块紫
      labelColor = 'text-purple-400';
    }

    nodes.push({
      id: entity.name,
      type: isModule ? 'group' : 'default', // 将 module 物理编译为包裹外框
      data: {
        label: (
          <div className="text-left font-mono text-[10px] p-1">
            <div className={`${labelColor} font-bold border-b border-gray-800 pb-0.5 mb-1`}>
              {isModule ? `[Module] ${entity.name}` : entity.name}
            </div>
            <div className="text-gray-400 scale-90 origin-left overflow-hidden text-ellipsis whitespace-nowrap w-32">
              {entity.providerOrPath.includes('/') ? entity.providerOrPath.split('/')[1] : entity.providerOrPath}
            </div>
          </div>
        )
      },
      position: { x: 60 + (xOffset * 190), y: yPos },
      style: {
        background: isModule ? 'rgba(168, 85, 247, 0.02)' : '#1e293b', 
        color: '#fff',
        border: `1px solid ${borderStroke}`,
        borderRadius: isModule ? '12px' : '8px', 
        width: isModule ? 220 : 160, 
        height: isModule ? 100 : 'auto' 
      }
    });
    xOffset++;
  });

  // 3. 🔍 【第三阶段】：隐式符号全文检索（彻底蒸发 dependsOn 限制）
  entityRegistry.forEach((targetEntity) => {
    symbolNames.forEach((sourceSymbol) => {
      // 排除法：防止自己依赖自己
      if (targetEntity.name === sourceSymbol) return;

      // 🎯 核心核心拦截：如果目标实体的代码正文（body）里包含了源资源的 symbolicName
      // 说明存在隐式依赖引用 (例如：subnet: spokeVnet.id)
      const symbolRegex = new RegExp(`\\b${sourceSymbol}\\b`);
      if (symbolRegex.test(targetEntity.body)) {

        // 规避重复边机制
        const edgeId = `edge-${sourceSymbol}-${targetEntity.name}`;
        if (!edges.some(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: sourceSymbol,
            target: targetEntity.name,
            animated: true,
            style: {
              stroke: targetEntity.type === 'module' ? '#a855f7' : '#00f2fe', // 容器线为模块紫
              strokeWidth: 1.5
            },
          });
        }
      }
    });
  });

  return { nodes, edges };
}