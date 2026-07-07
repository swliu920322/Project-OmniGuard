'use client';

import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { parseBicepToElements } from '@/utils/bicepParser';
import { AlertTriangle, Cpu } from 'lucide-react';

interface BicepTopologyCanvasProps {
  bicepCode: string;
  currentFile: string;
  onModuleNavigate: (modulePath: string) => void;
}

export default function BicepTopologyCanvas({ bicepCode, currentFile, onModuleNavigate }: BicepTopologyCanvasProps) {

  const topologyResult = useMemo(() => {
    if (!bicepCode.trim()) return { nodes: [] as Node[], edges: [] as Edge[], error: '文件内容为空，请注入 Bicep 源码。' };
    try {
      const { nodes, edges } = parseBicepToElements(bicepCode);
      if (nodes.length === 0) return { nodes: [] as Node[], edges: [] as Edge[], error: '未探测到标准的 resource 或 module 声明。配置解析失败。' };
      return { nodes, edges, error: null };
    } catch (err) {
      return { nodes: [] as Node[], edges: [] as Edge[], error: 'Bicep 语法结构发生严重断层，无法完成隐式符号对账。' };
    }
  }, [bicepCode]);

  const handleNodeDoubleClick = (event: React.MouseEvent, node: Node) => {
    console.log('[Topology DBG] === Double Click Event Triggered ===');
    console.log('[Topology DBG] Clicked Node ID:', node.id);
    console.log('[Topology DBG] Current File View:', currentFile);
    console.log('[Topology DBG] Bicep Code Length:', bicepCode?.length || 0);

    // Dynamic quote and spacing robust match
    const regex = new RegExp(`module\\s+${node.id}\\s+['"]([^'"]+)['"]`, 'i');
    const match = regex.exec(bicepCode);
    console.log('[Topology DBG] Regex Pattern:', regex.toString());
    console.log('[Topology DBG] Match Found:', match);

    if (match) {
      console.log('[Topology DBG] Match[1] Path:', match[1]);
      onModuleNavigate(match[1]);
    } else {
      console.warn('[Topology DBG] Failed to find module target path in Bicep code for node:', node.id);
    }
  };

  if (topologyResult.error) {
    return (
      <div className="w-full h-full bg-[#0a0f1d] flex flex-col items-center justify-center font-mono p-6">
        <div className="max-w-md bg-red-950/20 border-2 border-dashed border-red-500/50 rounded-xl p-6 text-center shadow-2xl">
          <AlertTriangle className="text-red-400 size-12 mx-auto mb-3 animate-bounce" />
          <h3 className="text-red-400 font-bold text-sm mb-1 uppercase tracking-widest">CONFIGURATION_PARSE_ERROR</h3>
          <p className="text-xs text-gray-400 leading-relaxed mb-4">{topologyResult.error}</p>
          <div className="text-[10px] text-gray-600 bg-black/40 py-1 px-2 rounded">TARGET_NODE: {currentFile}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg font-mono text-[10px] text-cyan-400 flex items-center space-x-1.5 backdrop-blur shadow-xl pointer-events-none">
        <Cpu size={12} className="animate-pulse" />
        <span>TOPOLOGY VIEW // FACT_DRIVEN_MODE</span>
      </div>

      <ReactFlow
        key={currentFile}
        nodes={topologyResult.nodes}
        edges={topologyResult.edges}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        colorMode="dark"
        className="w-full h-full cursor-grab active:cursor-grabbing focus:outline-none"
        panOnDrag={true}
        zoomOnDoubleClick={false}
        selectNodesOnDrag={false}
        nodesDraggable={false} // 🚫 禁用节点单独拖动，允许用户在节点上直接下按并拖拽移动整个画布
      >
        <Background color="#1e293b" gap={16} size={1} />
        <Controls className="m-4 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg shadow-2xl" />

        {/* 🎯【小地图满血自愈】：开启 zoomable 与 pannable，允许用户在右下角进行独立视角缩放拖动 */}
        <MiniMap
          zoomable
          pannable
          nodeColor={(n) => n.id.includes('Brain') || n.id.includes('Deployment') ? '#a855f7' : '#00f2fe'}
          maskColor="rgba(7, 11, 21, 0.6)"
          className="m-4 rounded-xl border border-slate-800 bg-slate-950/90"
        />
      </ReactFlow>
    </div>
  );
}