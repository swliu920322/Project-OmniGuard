'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Send, MessageSquare, Minimize2, Cpu, Cloud } from 'lucide-react';

// =========================================================================
// 🔒 模块级静态单例：物理斩断 Next.js HMR 和 React 严格模式导致的 WASM 内存踩踏
// =========================================================================
let globalEngineInstance: any = null;
let globalInitPromise: Promise<any> | null = null;
const SELECTED_LOCAL_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

// =========================================================================
// 🌐 核心算力外置原子函数 (Pristine Architectural Core)
// =========================================================================

/**
 * 管道一：本地 WebGPU 开源大模型流式推理管线
 * @param prompt 用户指令
 * @param onToken Token碎片弹射回调
 * @returns boolean 是否在本地自愈拦截成功
 */
async function localInferencePipeline(prompt: string, onToken: (token: string) => void): Promise<boolean> {
  const isComplexCloudIntent = /rag|insightflow|questvault|bicep|vnet|isolated|architecture/i.test(prompt);

  // 1. 拦截高能耗复杂企业架构意图，直接强制路由降级
  if (isComplexCloudIntent || !globalEngineInstance) {
    return false;
  }

  try {
    // 2. 调度 Mac GPU 统一内存执行本地张量爆破
    const chunks = await globalEngineInstance.chat.completions.create({
      messages: [
        { role: "system", content: "You are Shengwei's local AI assistant. Answer briefly based on his 10+ years full-stack master background." },
        { role: "user", content: prompt }
      ],
      stream: true,
    });

    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) onToken(delta);
    }
    return true; // 本地推理大获全胜
  } catch (err) {
    console.error("[WebGPU Pipeline Stall, Falling Back]", err);
    return false; // 发生未知异常，自动下放主权给级联云端
  }
}

/**
 * 管道二：远端新加坡 Azure Function ASGI 流式中枢公网管线
 * @param prompt 用户指令
 * @param pathname 当前页面路由上下文
 * @param onToken Token碎片弹射回调
 */
async function cloudInferencePipeline(prompt: string, pathname: string, onToken: (token: string) => void): Promise<void> {
  const base = process.env.NODE_ENV === 'development' ? 'http://localhost:7071' : '';
  const response = await fetch(`${base}/api/chat/stream?t=${Date.now()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prompt, context: pathname }) // 倒灌页面上下文
  });

  if (!response.ok) throw new Error(`HTTP Transport Error: ${response.status}`);
  if (!response.body) throw new Error('No streaming pipeline exposed');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const token = decoder.decode(value, { stream: true });
    if (token) onToken(token);
  }
}


// =========================================================================
// 🎨 UI 渲染与状态分发挂件 (Clean View Component)
// =========================================================================
export default function CognitiveAvatarWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string; isError?: boolean; source?: 'local' | 'cloud' }[]>([
    { role: 'ai', content: '系统就绪。WebGPU 本地大模型引擎正在底层初始化...', source: 'local' }
  ]);

  // 视图锁
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [gpuStatus, setGpuStatus] = useState<'ENGINE_LOADING' | 'WEBGPU_READY' | 'FALLBACK'>('ENGINE_LOADING');

  const mouthRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 🟩 初始化锁：单例防线
  useEffect(() => {
    let isMounted = true;
    async function initLocalGPUEngine() {
      if (!navigator.gpu) {
        if (isMounted) setGpuStatus('FALLBACK');
        return;
      }
      try {
        const webLLM = await import("@mlc-ai/web-llm");
        if (globalEngineInstance) {
          if (isMounted) {
            setGpuStatus('WEBGPU_READY');
            setMessages([{ role: 'ai', content: '你好！本地 WebGPU 大模型已复用全局单例堆栈。边缘分流网格已就绪。', source: 'local' }]);
          }
          return;
        }

        if (!globalInitPromise) {
          globalInitPromise = webLLM.CreateMLCEngine(SELECTED_LOCAL_MODEL, {
            initProgressCallback: (report) => {
              if (isMounted) {
                setMessages([{ role: 'ai', content: `本地大模型权重加载中: ${Math.round(report.progress * 100)}% ...`, source: 'local' }]);
              }
            }
          });
        }

        globalEngineInstance = await globalInitPromise;
        if (isMounted) {
          setGpuStatus('WEBGPU_READY');
          setMessages([{ role: 'ai', content: '你好！我的本地 WebGPU 显存大脑已满血加载。已为你布防第一线本地分流网格！', source: 'local' }]);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setGpuStatus('FALLBACK');
          setMessages([{ role: 'ai', content: '本地 WebGPU 加载失败，主权移交至云端机房。', source: 'cloud' }]);
        }
      }
    }
    initLocalGPUEngine();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 🟩 路由感知上下文自愈
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsTalking(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    let greeting = '已为您切换上下文。有什么我可以帮您的？';
    if (pathname === '/') {
      greeting = '您已回到履历主页。本地 WebGPU 已就绪，输入「你好、学历、经验、证书」将由本地显存秒回。';
    } else if (pathname.includes('/canvas')) {
      greeting = '已成功进驻智能架构画布。本地算力已加载全套 Bicep 与虚网隔离知识库沙盘。';
    }
    setMessages([{ role: 'ai', content: greeting, source: 'local' }]);
  }, [pathname]);

  // 🟩 音频口型驱动管线
  const triggerSpeechAudio = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.includes('SG') || v.lang.includes('US')) || null;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const updateLoop = () => {
      if (!isTalking) {
        if (mouthRef.current) mouthRef.current.style.transform = 'scaleY(0.15)';
        return;
      }
      const amplitude = Math.random() * 0.85 + 0.15;
      if (mouthRef.current) mouthRef.current.style.transform = `scaleY(${amplitude})`;
      animationRef.current = requestAnimationFrame(updateLoop);
    };
    utterance.onstart = () => { setIsTalking(true); updateLoop(); };
    utterance.onend = () => {
      setIsTalking(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mouthRef.current) mouthRef.current.style.transform = 'scaleY(0.15)';
    };
    window.speechSynthesis.speak(utterance);
  };

  // =========================================================================
  // ⚡ 极简有秩序的调度中心 (The Orchestrator)
  // =========================================================================
  const handleExecuteInference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim() || isProcessing) return;

    const currentInput = userPrompt.trim();
    setUserPrompt('');
    setIsProcessing(true); // 刚性锁死并发

    // 1. 压入用户原始问题气泡
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);

    // 2. 预埋单一 AI 气泡节点，作为流式原位弹射的受控槽位
    setMessages(prev => [...prev, { role: 'ai', content: '', source: 'local' }]);

    let buffer = "";
    const appendTokenToUI = (token: string) => {
      buffer += token;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = buffer;
        return updated;
      });
    };

    // 🟩 轨 A：触发第一道纯净的本地 WebGPU 工具函数管线
    const isLocalSuccess = await localInferencePipeline(currentInput, appendTokenToUI);

    if (isLocalSuccess) {
      if (buffer.trim()) triggerSpeechAudio(buffer);
      setIsProcessing(false); // 成功拦截，就地安全解闸
      return;
    }

    // 🟩 轨 B：本地踩空，原位更正标志位，无缝向下轰击云端 Function ASGI 管线
    try {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].source = 'cloud';
        updated[updated.length - 1].content = '本地算力未命中的领域，正在调度新加坡真机算力中枢...▋';
        return updated;
      });

      // 撞击云端外置函数
      await cloudInferencePipeline(currentInput, pathname, (token) => {
        // 复用同一个 UI 刷新回调，保持视图层的静默
        if (buffer === '本地算力未命中的领域，正在调度新加坡真机算力中枢...▋') {
          buffer = "";
        }
        appendTokenToUI(token);
      });

      if (buffer.trim()) triggerSpeechAudio(buffer);
    } catch (error) {
      console.error(error);
      setMessages(prev => {
        const errList = [...prev];
        errList[errList.length - 1].content = '云端边缘网络连线受挫，请确认本地后端 func start 是否正常供电。';
        errList[errList.length - 1].isError = true;
        return errList;
      });
    } finally {
      setIsProcessing(false); // 确保最后刚性放开输入控制闸
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans text-slate-200">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-emerald-400 hover:from-cyan-600 hover:to-emerald-500 active:scale-95 text-slate-950 font-bold rounded-full shadow-[0_10px_30px_rgba(0,242,254,0.3)] flex items-center justify-center border border-slate-950 transition-all duration-200"
        >
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
          </span>
          <MessageSquare size={24} className="text-slate-950" />
        </button>
      )}

      {isOpen && (
        <div className="w-85 sm:w-96 bg-gray-900 border border-[#00f2fe] shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-xl overflow-hidden flex flex-col transition-all animate-in fade-in slide-in-from-bottom-8 duration-200">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800">
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${gpuStatus === 'WEBGPU_READY' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-[10px] font-mono text-[#00f2fe] tracking-widest uppercase">
                HYBRID_CORE // ENGINE: {gpuStatus}
              </span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white transition-colors">
              <Minimize2 size={16} />
            </button>
          </div>

          <div className="w-full h-36 bg-gradient-to-b from-gray-800 to-[#0a0f1d] relative flex items-center justify-center border-b border-gray-800">
            <div className={`w-24 h-24 bg-gray-900 rounded-full flex flex-col items-center justify-center border-2 transition-all duration-300 ${isTalking ? 'border-rose-500 scale-105 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'border-[#00f2fe]'}`}>
              <div className="flex space-x-4 mb-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              </div>
              <div ref={mouthRef} className="w-8 h-4 bg-rose-500 rounded-full transition-transform duration-75 origin-center" style={{ transform: 'scaleY(0.15)' }} ></div>
            </div>
            <div className="absolute bottom-2 text-[0.6rem] text-gray-500 font-mono tracking-wider">
              CONTEXT: {pathname.toUpperCase()}
            </div>
          </div>

          <div className="h-48 overflow-y-auto p-4 bg-[#0a0f1d]/80 font-mono text-xs flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`p-2 rounded max-w-[85%] leading-relaxed flex flex-col ${
                msg.role === 'user' 
                  ? 'bg-gray-800 text-white self-end text-right' 
                  : msg.isError 
                    ? 'bg-red-900/30 border-l-2 border-red-500 text-red-400 self-start'
                    : 'bg-[#00f2fe]/10 border-l-2 border-[#00f2fe] text-[#00f2fe] self-start'
              }`}>
                <span>{msg.content || '▋'}</span>
                {msg.role === 'ai' && !msg.isError && (
                  <span className="text-[9px] text-gray-500 mt-1 flex items-center gap-1 font-sans self-end">
                    {msg.source === 'local' ? <Cpu size={10} /> : <Cloud size={10} />}
                    {msg.source === 'local' ? 'WebGPU 本地大模型' : 'Azure 新加坡核心网'}
                  </span>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleExecuteInference} className="flex border-t border-gray-800 bg-gray-900 p-2 gap-2">
            <input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder={isProcessing ? "解算核心正在全力输出..." : "向数字人输入指令..."}
              className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00f2fe] disabled:opacity-40"
              autoComplete="off"
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={isProcessing || !userPrompt.trim()}
              className="bg-[#00f2fe] hover:bg-[#00c8d4] disabled:bg-gray-800 text-[#0a0f1d] disabled:text-gray-600 font-bold px-4 rounded transition-colors flex items-center justify-center"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}