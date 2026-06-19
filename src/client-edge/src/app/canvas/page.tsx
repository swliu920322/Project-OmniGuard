'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css'; // 刚性引入官方核心视窗样式
import { Terminal, FolderTree, ChevronRight, Home, FolderOpen, Upload, Layers, Play } from 'lucide-react';
import Link from 'next/link';
import { parseBicepToElements } from '@/utils/bicepParser';
import { BICEP_ARCH_PRESETS } from '@/config/bicepPresets';

export default function BicepIntelligentCanvasPage() {
  // 核心虚拟文件系统与流控状态轴
  const [currentPresetKey, setCurrentPresetKey] = useState<string>('hub-spoke-network');
  const [virtualVFS, setVirtualVFS] = useState<Record<string, string>>(BICEP_ARCH_PRESETS['hub-spoke-network'].files);
  const [pathStack, setPathStack] = useState<string[]>(['main.bicep']);

  const currentFile = pathStack[pathStack.length - 1];
  const [bicepCode, setBicepCode] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🟩 1. 动态拓扑监听与编译器挂载
  useEffect(() => {
    const code = virtualVFS[currentFile] || virtualVFS['main.bicep'] || '';
    setBicepCode(code);
    executeLayoutCompilation(code);
  }, [virtualVFS, pathStack]);

  const executeLayoutCompilation = (codeToCompile: string) => {
    const { nodes: parsedNodes, edges: parsedEdges } = parseBicepToElements(codeToCompile);
    setNodes(parsedNodes);
    setEdges(parsedEdges);
  };

  const handlePresetSwitch = (presetKey: string) => {
    setCurrentPresetKey(presetKey);
    setVirtualVFS(BICEP_ARCH_PRESETS[presetKey].files);
    setPathStack(['main.bicep']);
  };

  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setVirtualVFS({ 'main.bicep': event.target?.result as string });
      setPathStack(['main.bicep']);
    };
    reader.readAsText(file);
  };

  const handleNodeDoubleClick = (event: React.MouseEvent, node: Node) => {
    const currentCodeText = virtualVFS[currentFile] || '';
    const regex = new RegExp(`module\\s+${node.id}\\s+'([^']+)'`);
    const match = regex.exec(currentCodeText);

    if (match && virtualVFS[match[1]]) {
      setPathStack(prev => [...prev, match[1]]);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden h-screen">

      {/* 顶级核心平台总线 */}
      <header className="border-b border-slate-800 px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-900/50 backdrop-blur z-20">
        <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
          <Link href="/" className="text-slate-500 hover:text-[#00f2fe] transition-all font-mono text-xs flex items-center gap-1">
            <Home size={14} /> 履历主页
          </Link>

          <div className="hidden md:block h-5 w-[1px] bg-slate-800"></div>

          {/* 方案预设总线 */}
          <div className="flex items-center space-x-2">
            <Layers size={14} className="text-purple-400" />
            <select
              value={currentPresetKey}
              onChange={(e) => handlePresetSwitch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 font-mono text-xs text-cyan-400 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {Object.entries(BICEP_ARCH_PRESETS).map(([key, value]) => (
                <option key={key} value={key}>{value.name}</option>
              ))}
            </select>
          </div>

          {/* 闪电文件上传 */}
          <div className="flex items-center">
            <input type="file" ref={fileInputRef} onChange={handleLocalFileUpload} accept=".bicep" className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-cyan-500 rounded font-mono text-xs text-slate-300 transition-colors"
            >
              <Upload size={12} className="text-emerald-400" />
              <span>上传本地 .bicep 文件</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4 font-mono text-xs text-slate-500">
          <div>VFS_NODES: <span className="text-emerald-400 font-bold">{Object.keys(virtualVFS).length}</span></div>
          <div>DEPTH: <span className="text-cyan-400 font-bold">{pathStack.length}</span></div>
        </div>
      </header>

      {/* 核心双舷布局空间 */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden h-[calc(100vh-65px)]">

        {/* 左舷：源码审计区 */}
        <div className="md:col-span-4 border-r border-slate-800 bg-[#070b15] p-4 flex flex-col overflow-hidden h-full">
          <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-900 mb-3">
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase flex items-center gap-1">
              <FolderOpen size={10} /> CURRENT: {currentFile}
            </span>
            <button
              onClick={() => executeLayoutCompilation(bicepCode)}
              className="text-[9px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded hover:bg-cyan-900 transition-colors"
            >
              COMPILE SOURCE
            </button>
          </div>
          <textarea
            value={bicepCode}
            onChange={(e) => {
              setBicepCode(e.target.value);
              setVirtualVFS(prev => ({ ...prev, [currentFile]: e.target.value }));
            }}
            className="w-full flex-1 bg-slate-950 border border-slate-900 rounded-xl p-4 font-mono text-xs leading-relaxed text-emerald-400 focus:outline-none focus:border-cyan-100 shadow-inner resize-none overflow-y-auto"
            spellCheck="false"
          />
        </div>

        {/* 右舷：自愈居中暗黑物理画布 (占 8 格) */}
        <div className="md:col-span-8 bg-[#0a0f1d] relative h-full overflow-hidden">

          {/* 路径导航绝对定位悬浮视窗 */}
          <div className="absolute top-4 left-4 right-4 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 p-3 rounded-xl backdrop-blur-md shadow-2xl">
            <div className="flex items-center space-x-2 font-mono text-xs">
              <FolderTree size={14} className="text-cyan-400" />
              <div className="flex items-center flex-wrap gap-1">
                {pathStack.map((path, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight size={12} className="text-slate-600 px-0.5" />}
                    <button
                      onClick={() => setPathStack(prev => prev.slice(0, idx + 1))}
                      disabled={idx === pathStack.length - 1}
                      className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                        idx === pathStack.length - 1 
                          ? 'text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-800/50 shadow-[0_0_10px_rgba(0,242,254,0.1)]' 
                          : 'hover:text-white text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {path === 'main.bicep' ? 'root-subscription' : path.replace('./', '')}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="text-[9px] font-mono text-slate-500 hidden sm:block">
              💡 双击 [📦 Module] 节点执行阶梯击穿钻取
            </div>
          </div>

          {/* Canvas 核心交互平面 */}
          <ReactFlow
            key={currentFile}       // 🎯 【绝杀二】：文件名状态锁。下钻时强行触发生命周期重绘，确保 fitView 开箱瞬间满血强制居中！
            nodes={nodes}
            edges={edges}
            onNodeDoubleClick={handleNodeDoubleClick}
            fitView                 // 刚性挂载自适应视野
            fitViewOptions={{ padding: 0.4 }} // 预留 40% 的黄金边缘呼吸空间，防止边界卡死
            colorMode="dark"        // 🎯 【绝杀一】：原生开启暗黑模式控制面，彻底撕碎并消灭 Tailwind 导致的“白化幽灵”
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

      </div>
    </main>
  );
}