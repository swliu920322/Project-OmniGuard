'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Home, FileCode, Code, BarChart3, Upload, Layers, FolderTree, ChevronRight, FolderOpen, LayoutGrid, Sliders } from 'lucide-react';
import BicepTopologyCanvas from '@/components/canvas/BicepTopologyCanvas';
import { BICEP_ARCH_PRESETS } from '@/config/bicepPresets';

interface LogicalTreeNode {
  name: string;
  path: string;
  children: LogicalTreeNode[];
}

function compileLogicalModuleTree(vfs: Record<string, string>, currentFile: string = 'main.bicep', visited = new Set<string>()): LogicalTreeNode {
  const node: LogicalTreeNode = { name: currentFile.replace('./', ''), path: currentFile, children: [] };
  if (visited.has(currentFile)) return node;
  visited.add(currentFile);

  const fileContent = vfs[currentFile] || '';
  const regex = /module\s+\w+\s+'([^']+)'/g;
  let match;

  while ((match = regex.exec(fileContent)) !== null) {
    const childPath = match[1];
    if (vfs[childPath]) {
      node.children.push(compileLogicalModuleTree(vfs, childPath, visited));
    }
  }
  return node;
}

/**
 * 🟩 🚀【新增核心寻轨引擎】：利用递归 DFS 在内存中瞬间算解从 main.bicep 抵达指定文件的完整面包屑历史栈
 */
function computeLogicalPathTo(vfs: Record<string, string>, targetFile: string, current = 'main.bicep', currentStack: string[] = [], visited = new Set<string>()): string[] | null {
  if (current === targetFile) return [...currentStack, current];
  if (visited.has(current)) return null;
  visited.add(current);

  const fileContent = vfs[current] || '';
  const regex = /module\s+\w+\s+'([^']+)'/g;
  let match;

  while ((match = regex.exec(fileContent)) !== null) {
    const childPath = match[1];
    const result = computeLogicalPathTo(vfs, targetFile, childPath, [...currentStack, current], visited);
    if (result) return result;
  }
  return null;
}

function CanvasDashboardCore() {
  const searchParams = useSearchParams();
  const presetQuery = searchParams.get('preset');
  const initialPresetKey = presetQuery && BICEP_ARCH_PRESETS[presetQuery] ? presetQuery : 'hub-spoke-network';

  const [virtualVFS, setVirtualVFS] = useState<Record<string, string>>(BICEP_ARCH_PRESETS[initialPresetKey].files);
  const [activeFile, setActiveFile] = useState<string>('main.bicep');
  const [pathStack, setPathStack] = useState<string[]>(['main.bicep']);
  const [activeTab, setActiveTab] = useState<'code' | 'diagram'>('diagram');
  const [bicepCode, setBicepCode] = useState('');

  const multiFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const code = virtualVFS[activeFile] || virtualVFS['main.bicep'] || '';
    setBicepCode(code);
  }, [virtualVFS, activeFile]);

  useEffect(() => {
    if (presetQuery && BICEP_ARCH_PRESETS[presetQuery]) {
      setVirtualVFS(BICEP_ARCH_PRESETS[presetQuery].files);
      setActiveFile('main.bicep');
      setPathStack(['main.bicep']);
    }
  }, [presetQuery]);

  const handleBatchFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newVFS: Record<string, string> = {};
    let hasMain = false;
    let firstFile = '';

    const loaders = Array.from(files).map((file) => {
      return new Promise<void>((resolve) => {
        const rawPath = file.webkitRelativePath || file.name;
        const cleanPath = rawPath.includes('/') ? `./${rawPath.split('/').slice(1).join('/')}` : rawPath;
        if (file.name === 'main.bicep') { hasMain = true; newVFS['main.bicep'] = ''; }

        const reader = new FileReader();
        reader.onload = (evt) => {
          const content = evt.target?.result as string;
          if (file.name === 'main.bicep') newVFS['main.bicep'] = content;
          else newVFS[cleanPath] = content;
          if (!firstFile) firstFile = file.name === 'main.bicep' ? 'main.bicep' : cleanPath;
          resolve();
        };
        reader.readAsText(file);
      });
    });

    Promise.all(loaders).then(() => {
      setVirtualVFS(newVFS);
      const target = hasMain ? 'main.bicep' : firstFile;
      setActiveFile(target);
      setPathStack([target]);
    });
  };

  const handleCanvasModuleDrillDown = (modulePath: string) => {
    if (virtualVFS[modulePath]) {
      setActiveFile(modulePath);
      setPathStack(prev => prev.includes(modulePath) ? prev : [...prev, modulePath]);
    }
  };

  // 🟩 递归树节点点击处理器：加装寻轨引信
  const handleFileTreeClick = (targetPath: string) => {
    setActiveFile(targetPath);
    // 🎯 刚性对账：计算完整依赖链条，自愈回灌历史栈，绝不再平铺扁平化
    const computedStack = computeLogicalPathTo(virtualVFS, targetPath);
    if (computedStack) {
      setPathStack(computedStack);
    } else {
      setPathStack([targetPath]); // 极端孤立文件兜底
    }
  };

  const renderLogicalTree = (node: LogicalTreeNode, depth = 0) => {
    const isActive = node.path === activeFile;
    return (
      <div key={node.path} className="flex flex-col">
        <button
          onClick={() => handleFileTreeClick(node.path)}
          style={{ paddingLeft: `${Math.max(depth * 16, 8)}px` }}
          className={`flex items-center justify-between text-left py-2 px-3 rounded-lg border transition-all ${
            isActive 
              ? 'bg-cyan-950/30 border-cyan-800/60 text-cyan-400 font-bold shadow-[0_0_10px_rgba(0,242,254,0.05)]' 
              : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2 overflow-hidden">
            <FileCode size={13} className={isActive ? 'text-cyan-400' : 'text-slate-500'} />
            <span className="truncate">{node.name}</span>
          </div>
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f2fe]"></div>}
        </button>
        {node.children.length > 0 && (
          <div className="mt-1 border-l border-slate-900/60 ml-4 flex flex-col gap-1">
            {node.children.map(child => renderLogicalTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const logicalTreeRoot = compileLogicalModuleTree(virtualVFS);
  const lineCountArray = bicepCode.split('\n');

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden h-full">

        {/* 左舷：逻辑树 */}
        <div className="md:col-span-3 border-r border-slate-800 bg-[#070b15] p-4 flex flex-col overflow-y-auto select-none">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-900 mb-3">
            <FolderTree size={14} className="text-slate-400" />
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">LOGICAL_CALL_TREE</span>
          </div>
          <div className="flex flex-col gap-1 font-mono text-xs mt-1">
            {renderLogicalTree(logicalTreeRoot)}
          </div>
        </div>

        {/* 右舷：Tab */}
        <div className="md:col-span-9 flex flex-col h-full bg-[#0a0f1d] overflow-hidden relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border-b border-slate-900 bg-slate-950/60 backdrop-blur-md z-10 gap-3">
            <div className="flex items-center space-x-1.5 font-mono text-xs">
              <ChevronRight size={14} className="text-slate-600" />
              <div className="flex items-center flex-wrap gap-1">
                {pathStack.map((path, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const targetPath = pathStack[idx];
                      setActiveFile(targetPath);
                      setPathStack(prev => prev.slice(0, idx + 1));
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] transition-all ${idx === pathStack.length - 1 ? 'text-cyan-400 font-bold bg-cyan-950/40' : 'text-slate-400 hover:text-white'}`}
                  >
                    {path === 'main.bicep' ? 'root' : path.replace('./', '')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg font-mono text-xs">
              <button onClick={() => setActiveTab('diagram')} className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md ${activeTab === 'diagram' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}>
                <BarChart3 size={13} /> <span>TOPOLOGY_CANVAS</span>
              </button>
              <button onClick={() => setActiveTab('code')} className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md ${activeTab === 'code' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}>
                <Code size={13} /> <span>MANIFEST_EDITOR</span>
              </button>
            </div>
          </div>

          <div className="flex-1 w-full h-full overflow-hidden relative">
            {activeTab === 'code' && (
              <div className="w-full h-full p-4 flex flex-col bg-[#050811]">
                <div className="flex-1 flex border border-slate-900 rounded-xl overflow-hidden bg-slate-950">
                  <div className="w-11 bg-[#090d16] text-slate-600 font-mono text-[11px] text-right pr-2 select-none pt-4 border-r border-slate-900/60 leading-relaxed overflow-hidden">
                    {lineCountArray.map((_, i) => <div key={i} className="h-5">{i + 1}</div>)}
                  </div>
                  <textarea
                    value={bicepCode}
                    onChange={(e) => { setBicepCode(e.target.value); setVirtualVFS(prev => ({ ...prev, [activeFile]: e.target.value })); }}
                    className="flex-1 bg-transparent p-4 font-mono text-xs leading-relaxed text-emerald-400 focus:outline-none resize-none overflow-y-auto h-full"
                    style={{ lineHeight: '1.25rem' }} spellCheck="false"
                  />
                </div>
              </div>
            )}

            {activeTab === 'diagram' && (
              <div className="w-full h-full">
                <BicepTopologyCanvas bicepCode={bicepCode} currentFile={activeFile} onModuleNavigate={handleCanvasModuleDrillDown} />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function BicepIntelligentCanvasPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden h-screen">
      <header className="border-b border-slate-800 px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-900/50 backdrop-blur z-20">
        <div className="flex items-center space-x-3">
          <Link href="/iac" className="text-slate-400 hover:text-[#00f2fe] text-xs font-mono flex items-center gap-1 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-xl">
            <LayoutGrid size={14} /> 返回方案大厅
          </Link>
        </div>
        <div className="text-[11px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <Sliders size={12} className="text-cyan-400" />
          <span>Interactive Blueprint Auditor</span>
        </div>
      </header>

      <Suspense fallback={<div className="p-6 font-mono text-xs text-slate-500">正在同步真机拓扑空间...</div>}>
        <CanvasDashboardCore />
      </Suspense>
    </main>
  );
}