import { Node, Edge } from '@xyflow/react';

export function parseBicepToElements(bicepText: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const resourceBlockRegex = /(resource|module)\s+(\w+)\s+'([^']+)'\s*=\s*\{([\s\S]*?)\}/g;
  const bicepBlocks: { name: string; type: string; isModule: boolean; body: string }[] = [];
  const symbolNames: string[] = [];
  let match;

  // 1. 字典建立
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

  // 2. 隐式依赖度矩阵解算 (用于计算布局梯度，消除水平平铺)
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

  // 3. 物理阶梯坐标渲染
  const xCounters: Record<number, number> = {};

  bicepBlocks.forEach((block) => {
    const depth = dependencyDegrees[block.name] || 0;
    if (xCounters[depth] === undefined) xCounters[depth] = 0;

    // 根据依赖深度计算 Y 轴阶梯，横向根据计数器分散
    const posX = 40 + (xCounters[depth] * 240);
    const posY = 60 + (depth * 160);
    xCounters[depth]++;

    const isNet = block.type.includes('Network') || block.type.includes('virtualNetworks');
    const borderStroke = block.isModule ? '#a855f7' : isNet ? '#00f2fe' : '#10b981';
    const labelColor = block.isModule ? 'text-purple-400' : isNet ? 'text-cyan-400' : 'text-emerald-400';

    nodes.push({
      id: block.name,
      type: block.isModule ? 'default' : 'default', // 模块在主页作为高阶节点展示，双击即可击穿下钻
      data: {
        label: (
          <div className="text-left font-mono text-[10px] p-1 select-none">
            <div className={`${labelColor} font-bold border-b border-gray-800 pb-0.5 mb-1 flex justify-between items-center`}>
              <span>{block.isModule ? `📦 ${block.name}` : block.name}</span>
              {block.isModule && <span className="text-[8px] bg-purple-900/50 px-1 rounded border border-purple-500 text-purple-300 scale-90">双击下钻</span>}
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
        boxShadow: block.isModule ? '0 0 15px rgba(168, 85, 247, 0.15)' : 'none'
      }
    });
  });

  // 4. 连线合拢
  bicepBlocks.forEach(target => {
    symbolNames.forEach(source => {
      if (target.name === source) return;
      const regex = new RegExp(`\\b${source}\\b`);
      if (regex.test(target.body)) {
        edges.push({
          id: `edge-${source}-${target.name}`,
          source: source,
          target: target.name,
          animated: true,
          style: { stroke: target.isModule ? '#a855f7' : '#00f2fe', strokeWidth: 1.5 },
        });
      }
    });
  });

  return { nodes, edges };
}