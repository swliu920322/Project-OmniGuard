'use client';

import { useEffect, useRef, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import 'reactflow/dist/style.css';

export default function CanvasPage() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // 🟩 跨线程绑定：原位初始化本地多线程 Web Worker
    workerRef.current = new Worker(new URL('../../workers/bicep.worker.ts', import.meta.url));

    workerRef.current.onmessage = (event) => {
      const { nodes: parsedNodes, edges: parsedEdges } = event.data;
      setNodes(parsedNodes);
      setEdges(parsedEdges);
    };

    return () => workerRef.current?.terminate();
  }, []);

  const handleFolderDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    const fileMap = new Map<string, string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i].webkitGetAsEntry();
      if (item && item.isFile && item.name.endsWith('.bicep')) {
        const file = items[i].getAsFile();
        if (file) {
          const text = await file.text();
          fileMap.set(item.name, text);
        }
      }
    }
    // 🚀 剥离算力：强行扔进后台沙盒线程，主线程延迟瞬间清零
    workerRef.current?.postMessage(fileMap);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFolderDrop}
      className="w-screen h-screen relative bg-[#060b14]"
    >
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-slate-950/80 p-3 rounded border border-slate-800 backdrop-blur">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="h-4 w-px bg-slate-800"></div>
        <div className="font-mono text-xs">
          <p className="text-[#00f2fe] font-bold">MODULE BETA: IAC TOPOLOGY CANVAS</p>
          <p className="text-slate-500 mt-0.5">Drag & Drop .bicep manifests here</p>
        </div>
      </div>

      <ReactFlow nodes={nodes} edges={edges}>
        <Background color="#141b2d" gap={20} size={1} />
        <Controls className="bg-slate-900 border border-slate-800 text-slate-200 fill-slate-200" />
      </ReactFlow>
    </div>
  );
}