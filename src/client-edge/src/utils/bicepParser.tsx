import { Node, Edge } from '@xyflow/react';

export function parseBicepToElements(bicepText: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const resourceBlockRegex = /(resource|module)\s+(\w+)\s+'([^']+)'\s*=\s*\{([\s\S]*?)\}/g;
  const bicepBlocks: { name: string; type: string; isModule: boolean; body: string }[] = [];
  const symbolNames: string[] = [];
  let match;

  // 🏁 阶段一：建立全局符号字典
  while ((match = resourceBlockRegex.exec(bicepText)) !== null) {
    const isModule = match[1] === 'module';
    bicepBlocks.push({
      name: match[2],
      type: match[3].split('@')[0],
      isModule: isModule,
      body: match[4]
    });
    symbolNames.push(match[2]);
  }

  // 延迟对账队列：专门收拢网络 Peering 关系流
  const deferredPeeringEdges: Edge[] = [];

  // 🏁 阶段二：计算隐式依赖梯度
  const dependencyDegrees: Record<string, number> = {};
  symbolNames.forEach(s => dependencyDegrees[s] = 0);

  bicepBlocks.forEach(target => {
    symbolNames.forEach(source => {
      if (target.name === source) return;
      const regex = new RegExp(`\\b${source}\\b`);
      if (regex.test(target.body)) {
        dependencyDegrees[target.name] = (dependencyDegrees[target.name] || 0) + 1;
      }
    });
  });

  // 🏁 阶段三：物理节点排布（前置拦截 Peering 二进制空下方块）
  const xCounters: Record<number, number> = {};

  bicepBlocks.forEach((block) => {
    // 🎯 【核心绝杀】：拦截 Azure 原生虚网对等组件，拒绝生成独立方块
    if (block.type === 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings') {
      const parentMatch = /parent:\s*(\w+)/.exec(block.body);
      const remoteMatch = /remoteVirtualNetwork:\s*\{\s*id:\s*([\w.]+)/.exec(block.body);

      const sourceVNet = parentMatch ? parentMatch[1] : null;
      const targetVNet = remoteMatch ? remoteMatch[1].split('.')[0] : null;

      if (sourceVNet && targetVNet) {
        deferredPeeringEdges.push({
          id: `peering-edge-${block.name}`,
          source: sourceVNet,
          target: targetVNet,
          animated: true,
          label: 'VNet Peering 高速互联',
          labelStyle: { fill: '#f43f5e', fontSize: 8, fontWeight: 'bold', fontFamily: 'monospace' },
          style: { stroke: '#f43f5e', strokeWidth: 2, strokeDasharray: '4,4', pointerEvents: 'none' }, // 霓虹粉高亮虚线管道
        });
      }
      return; // 截断，不将其推入节点网格
    }

    const depth = dependencyDegrees[block.name] || 0;
    if (xCounters[depth] === undefined) xCounters[depth] = 0;

    const posX = 40 + (xCounters[depth] * 240);
    const posY = 80 + (depth * 160);
    xCounters[depth]++;

    const isNet = block.type.includes('Network') || block.type.includes('virtualNetworks');
    const borderStroke = block.isModule ? '#a855f7' : isNet ? '#00f2fe' : '#10b981';
    const labelColor = block.isModule ? 'text-purple-400' : isNet ? 'text-cyan-400' : 'text-emerald-400';

    nodes.push({
      id: block.name,
      type: 'default',
      data: {
        label: (
          <div className="text-left font-mono text-[10px] p-1 select-none">
            <div className={`${labelColor} font-bold border-b border-gray-800 pb-0.5 mb-1 flex justify-between items-center`}>
              <span>{block.isModule ? `📦 ${block.name}` : block.name}</span>
              {block.isModule && <span className="text-[7px] bg-purple-900/40 px-1 rounded border border-purple-500 text-purple-300">双击下钻</span>}
            </div>
            <div className="text-gray-400 scale-90 origin-left overflow-hidden text-ellipsis whitespace-nowrap w-36">
              {block.type.includes('/') ? block.type.split('/')[1] : block.type}
            </div>
          </div>
        )
      },
      position: { x: posX, y: posY },
      style: {
        background: '#131927',
        color: '#fff',
        border: `1px solid ${borderStroke}`,
        borderRadius: '8px',
        width: 170,
        boxShadow: block.isModule ? '0 0 12px rgba(168, 85, 247, 0.12)' : 'none'
      }
    });
  });

  // 🏁 阶段四：符号对账全量闭环
  bicepBlocks.forEach(target => {
    if (target.type === 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings') return; // 跳过已抽离组件
    symbolNames.forEach(source => {
      if (target.name === source) return;
      const regex = new RegExp(`\\b${source}\\b`);
      if (regex.test(target.body)) {
        edges.push({
          id: `edge-${source}-${target.name}`,
          source: source,
          target: target.name,
          animated: true,
          style: { stroke: target.isModule ? '#a855f7' : '#00f2fe', strokeWidth: 1.5, pointerEvents: 'none' },
        });
      }
    });
  });

  // 🟩 倒灌特制网络 Peering 通道管道线
  return { nodes, edges: [...edges, ...deferredPeeringEdges] };
}