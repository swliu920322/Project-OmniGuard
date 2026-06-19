'use client';

import React, { useState, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Terminal, Play, Sparkles, LayoutGrid, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { parseBicepToElements } from '@/utils/bicepParser';

// 🟩 完美的模块化父子嵌套 + 纵向三层依赖测试沙盘
const REALISTIC_AZURE_BICEP = `// MODULE-BETA // ENTERPRISE LANDING ZONE SANDBOX
resource vnet_core 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'omni-vnet-sea'
  location: 'southeastasia'
}

resource backend_subnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  name: 'BackendSubnet'
  parent: vnet_core
}

resource nic_brain 'Microsoft.Network/networkInterfaces@2023-11-01' = {
  name: 'omni-brain-nic'
  location: 'southeastasia'
  dependsOn: [
    vnet_core
  ]
}

resource compute_brain 'Microsoft.Compute/virtualMachines@2023-11-01' = {
  name: 'omni-digitalhuman-brain'
  location: 'southeastasia'
  dependsOn: [
    nic_brain
    backend_subnet
  ]
}

resource storage_ledger 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'omniguardledgerstore'
  location: 'southeastasia'
  dependsOn: [
    compute_brain
  ]
}`;

export default function BicepIntelligentCanvasPage() {
  const [bicepCode, setBicepCode] = useState(REALISTIC_AZURE_BICEP);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    handleCompileTopology(REALISTIC_AZURE_BICEP);
  }, []);

  const handleCompileTopology = (codeToCompile: string) => {
    const { nodes: parsedNodes, edges: parsedEdges } = parseBicepToElements(codeToCompile);
    setNodes(parsedNodes);
    setEdges(parsedEdges);
  };

  const handleTriggerGenAIBicep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(false);
    handleCompileTopology(bicepCode);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-900/50 backdrop-blur">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-slate-400 hover:text-[#00f2fe] transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-bold tracking-wider text-cyan-400 font-mono">
              MODULE BETA // BICEP_HIERARCHICAL_CANVAS
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">Status: Hierarchical Nested Layout Engine Active</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleCompileTopology(bicepCode)}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-slate-950 font-mono font-bold text-xs rounded transition-all"
          >
            <Play size={12} fill="currentColor" />
            <span>COMPILE & ALIGN</span>
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden h-[calc(100vh-65px)]">

        {/* 左舷控制盘 */}
        <div className="md:col-span-5 border-r border-slate-800 bg-[#070b15] p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <div className="flex items-center space-x-2 mb-2">
                <Sparkles size={14} className="text-cyan-400" />
                <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">GenAI Blueprint Prompter</label>
              </div>
              <form onSubmit={handleTriggerGenAIBicep} className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="本地沙盘调试，直接点击右侧 COMPILE 触发分层对账..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 path-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  disabled={true}
                />
                <button
                  type="submit"
                  disabled={true}
                  className="px-4 bg-slate-800 text-slate-500 font-mono text-xs rounded"
                >
                  MOCK
                </button>
              </form>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center space-x-2 px-1 pb-2">
                <Terminal size={12} className="text-slate-500" />
                <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Nested Bicep Script</span>
              </div>
              <textarea
                value={bicepCode}
                onChange={(e) => setBicepCode(e.target.value)}
                className="w-full h-[480px] bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs leading-relaxed text-emerald-400 focus:outline-none focus:border-cyan-500 resize-none shadow-inner"
                spellCheck="false"
              />
            </div>
          </div>
          <div className="text-[9px] font-mono text-slate-600 pt-3 border-t border-slate-900">
            HIERARCHICAL_GRID: TRUE // SUBGRAPH_BOUNDING: TRUE
          </div>
        </div>

        {/* 右舷核心画布 */}
        <div className="md:col-span-7 bg-[#0a0f1d] relative h-full">
          <div className="absolute top-4 left-4 z-10 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded font-mono text-[10px] text-cyan-400 flex items-center space-x-1.5 backdrop-blur">
            <LayoutGrid size={12} />
            <span>NESTED NESTED SUBGRAPH CANVASES</span>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            className="w-full h-full"
          >
            <Background color="#1e293b" gap={16} size={1} />
            <Controls className="bg-slate-900 border border-slate-800 text-white rounded fill-white scale-90" />
            <MiniMap
              nodeColor={(n) => n.type === 'group' ? 'rgba(0,242,254,0.1)' : '#10b981'}
              maskColor="rgba(7, 11, 21, 0.7)"
              className="bg-slate-900 border border-slate-800 rounded scale-75 origin-bottom-right"
            />
          </ReactFlow>
        </div>

      </div>
    </main>
  );
}