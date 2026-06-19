import { Node, Edge } from '@xyflow/react';

export function parseBicepToElements(bicepText: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // 清洗换装：精细化正则雷达，捕获资源名称、类型及腹地大括号内容
  const resourceBlockRegex = /resource\s+(\w+)\s+'([^']+)'\s*=\s*\{([\s\S]*?)\}/g;

  const bicepBlocks: { name: string; type: string; body: string }[] = [];
  let match;

  // 🏁 阶段一：全量扫描并结构化清洗文本块
  while ((match = resourceBlockRegex.exec(bicepText)) !== null) {
    bicepBlocks.push({
      name: match[1],
      type: match[2].split('@')[0], // 剥离版本号，保留 Microsoft.Network/virtualNetworks
      body: match[3]
    });
  }

  // 布局控制常数
  const LAYER_Y_MAP: Record<string, number> = {
    'Microsoft.Network/virtualNetworks': 50,
    'Microsoft.Network/virtualNetworks/subnets': 40, // 局部相对坐标
    'Microsoft.Network/networkInterfaces': 240,
    'Microsoft.Compute/virtualMachines': 320,
    'Microsoft.Storage/storageAccounts': 520,
  };

  let xCounters: Record<string, number> = { group: 0, global: 0, sub: 0 };

  // 🏁 阶段二：执行多活分流与容器解算
  bicepBlocks.forEach((block) => {
    const isVNet = block.type === 'Microsoft.Network/virtualNetworks';

    // 1. 拦截虚网：刚性将其编译为 type: 'group' 的模块化物理外框
    if (isVNet) {
      nodes.push({
        id: block.name,
        type: 'group',
        data: { label: block.name },
        position: { x: 50 + (xCounters.group * 450), y: LAYER_Y_MAP[block.type] || 50 },
        style: {
          width: 380,
          height: 140,
          backgroundColor: 'rgba(0, 242, 254, 0.03)',
          border: '2px dashed #00f2fe',
          borderRadius: '12px',
        },
      });
      xCounters.group++;
      return;
    }

    // 2. 拦截子网：探测是否显式属于某个父级容器
    const parentMatch = /parent:\s*(\w+)/.exec(block.body);
    const isSubnet = block.type === 'Microsoft.Network/virtualNetworks/subnets';

    if (isSubnet && parentMatch) {
      const parentId = parentMatch[1];
      nodes.push({
        id: block.name,
        parentId: parentId, // 🎯 建立 React Flow 嵌套契约
        extent: 'parent',   // 锁定死在父容器内部，严禁拖拽出界
        data: {
          label: (
            <div className="text-left font-mono text-[9px] p-1">
              <div className="text-amber-400 font-bold border-b border-gray-800 pb-0.5 mb-1">[Subnet] {block.name}</div>
              <div className="text-gray-500 scale-90 origin-left">Secure Private Enclave</div>
            </div>
          )
        },
        position: { x: 20 + (xCounters.sub * 180), y: LAYER_Y_MAP[block.type] || 40 },
        style: {
          background: '#0f172a',
          color: '#fff',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          width: 160,
        }
      });
      xCounters.sub++;
      return;
    }

    // 3. 纵向分层解算：普通全球静态资源（VM, NIC, Storage）
    let yPos = LAYER_Y_MAP[block.type] || 200;
    nodes.push({
      id: block.name,
      type: 'default',
      data: {
        label: (
          <div className="text-left font-mono text-[10px] p-1">
            <div className="text-emerald-400 font-bold border-b border-gray-800 pb-0.5 mb-1">{block.name}</div>
            <div className="text-gray-400 scale-90 origin-left overflow-hidden text-ellipsis whitespace-nowrap w-32">
              {block.type.split('/')[1]}
            </div>
          </div>
        )
      },
      position: { x: 80 + (xCounters.global * 200), y: yPos },
      style: {
        background: '#1e293b',
        color: '#fff',
        border: '1px solid #10b981',
        borderRadius: '8px',
        width: 150,
      }
    });
    xCounters.global++;
  });

  // 🏁 阶段三：自动化解算dependsOn纵向控制总线
  bicepBlocks.forEach((block) => {
    const dependsOnMatch = /dependsOn:\s*\[([\s\S]*?)\]/.exec(block.body);
    if (dependsOnMatch) {
      const dependencies = dependsOnMatch[1]
        .split(/[\s,\[\]]+/)
        .map(d => d.trim())
        .filter(d => d && d !== block.name);

      dependencies.forEach((dep) => {
        // 健壮性验证：确保依赖源真实存在于节点网格中
        if (nodes.some(n => n.id === dep)) {
          edges.push({
            id: `edge-${dep}-${block.name}`,
            source: dep,
            target: block.name,
            animated: true,
            style: { stroke: '#00f2fe', strokeWidth: 1.5 },
          });
        }
      });
    }
  });

  return { nodes, edges };
}