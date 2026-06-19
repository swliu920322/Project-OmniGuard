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

  // 🟩 1. 拦截解析引信：在内存中计算拓扑，捕获任何潜在的语法毒性
  const topologyResult = useMemo(() => {
    if (!bicepCode.trim()) return { nodes: [], edges: [], error: '文件内容为空，请注入 Bicep 源码。' };
    try {
      const { nodes, edges } = parseBicepToElements(bicepCode);
      if (nodes.length === 0) {
        return { nodes: [], edges: [], error: '未探测到标准的 resource 或 module 声明。配置解析失败。' };
      }
      return { nodes, edges, error: null };
    } catch (err) {
      return { nodes: [], edges: [], error: 'Bicep 语法结构发生严重断层，无法完成隐式符号对账。' };
    }
  }, [bicepCode]);

  const handleNodeDoubleClick = (event: React.MouseEvent, node: Node) => {
    // 探测当前双击的节点是否包含 module 路径声明
    const regex = new RegExp(`module\\s+${node.id}\\s+'([^']+)'`);
    const match = regex.exec(bicepCode);
    if (match) {
      onModuleNavigate(match[1]); // 触发外置的 VFS 路径跳转总线
    }
  };

  // 🟩 2. 降级安全边界：如果解析翻车，原地卸载 React Flow，升起错误贴片
  if (topologyResult.error) {
    return (
      <div className="w-full h-full bg-[#0a0f1d] flex flex-col items-center justify-center font-mono p-6 animate-in fade-in duration-200">
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
        key={currentFile} // 刚性文件名键，发生下钻时强制刷新周期，确保 fitView 100% 垂直居中
        nodes={topologyResult.nodes}
        edges={topologyResult.edges}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        colorMode="dark" // 官方原生暗黑模式控制面，彻底消灭白色幽灵污染
        className="w-full h-full"
      >
        <Background color="#1e293b" gap={16} size={1} />
        <Controls className="m-4 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg shadow-2xl" />
        <MiniMap
          nodeColor={(n) => n.id.includes('Brain') || n.id.includes('Deployment') ? '#a855f7' : '#00f2fe'}
          maskColor="rgba(7, 11, 21, 0.7)"
          className="m-4 rounded-xl border border-slate-800"
        />
      </ReactFlow>
    </div>
  );
}