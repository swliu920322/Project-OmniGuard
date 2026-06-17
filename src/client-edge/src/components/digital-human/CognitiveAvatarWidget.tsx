'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Send, MessageSquare, X, Minimize2 } from 'lucide-react';

export default function CognitiveAvatarWidget() {
  const pathname = usePathname(); // 🎯 神经触角：捕获当前页面路由
  const [isOpen, setIsOpen] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string; isError?: boolean }[]>([
    { role: 'ai', content: '你好，我是刘胜伟的 AI 助理。当前已安全连接云端脑干实例。' }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTalking, setIsTalking] = useState(false);

  const mouthRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 自动化对齐：滚动条锁定末端
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 🟩 路由联动自愈：感知到跨页切换时，数字人自动按页编排导论
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsTalking(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    let pageContextGreeting = '已为您切换上下文。有什么我可以帮您的？';
    if (pathname === '/') {
      pageContextGreeting = '您已回到我的精美履历主页。这里锁死了我 10 年的全栈与云架构资产，您可以随时询问关于 Accenture、Scania 的核心交付细节。';
    } else if (pathname.includes('/canvas')) {
      pageContextGreeting = '成功进驻 Module Beta: 智能架构画布空间！此区域托管了全套 Bicep 拓扑验证沙盘，您可以向我提问任何关于虚网隔离或弹性算力的物理细节。';
    }
    setMessages([{ role: 'ai', content: pageContextGreeting }]);
  }, [pathname]);

  // 🟩 音频动作拟合：用随机振幅高频强控 CSS scaleY 变形
  const triggerMouthMotion = (utterance: SpeechSynthesisUtterance) => {
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
  };

  // 🟩 击穿本地 ASGI 流式读取管线
  const handleExecuteInference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim() || isProcessing) return;

    const currentInput = userPrompt;
    setUserPrompt('');
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
    setIsProcessing(false);
    setIsStreaming(true);

    try {
      const base = "";
      const response = await fetch(`${base}/api/chat/stream?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, context: pathname }) // 🎯 倒灌页面上下文
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error('No stream pipeline found');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      setMessages(prev => [...prev, { role: 'ai', content: '' }]);
      let fullTextPayload = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const token = decoder.decode(value, { stream: true });
        fullTextPayload += token;

        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content += token;
          return newMsgs;
        });
      }

      if (fullTextPayload.trim()) {
        const speech = new SpeechSynthesisUtterance(fullTextPayload);
        const voices = window.speechSynthesis.getVoices();
        speech.voice = voices.find(v => v.lang.includes('SG') || v.lang.includes('US')) || null;
        triggerMouthMotion(speech);
        window.speechSynthesis.speak(speech);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', content: '边缘节点通信异常，请检查本地开发环境的 AzFunction 代理状态。', isError: true }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const [isStreaming, setIsStreaming] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans text-slate-200">

      {/* 🟢 极简悬浮球模式 (FAB) */}
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

      {/* 🔴 侧边浮动面板模式 */}
      {isOpen && (
        <div className="w-85 sm:w-96 bg-gray-900 border border-[#00f2fe] shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-xl overflow-hidden flex flex-col transition-all animate-in fade-in slide-in-from-bottom-8 duration-200">

          {/* 控制头栏 */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-mono text-[#00f2fe] tracking-widest uppercase">AVATAR_COGNITIVE_CORE</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <Minimize2 size={16} />
            </button>
          </div>

          {/* WebGPU 占位动作画布 */}
          <div className="w-full h-36 bg-gradient-to-b from-gray-800 to-[#0a0f1d] relative flex items-center justify-center border-b border-gray-800">
            <div className={`w-24 h-24 bg-gray-900 rounded-full flex flex-col items-center justify-center border-2 transition-all duration-300 ${isTalking ? 'border-rose-500 scale-105 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'border-[#00f2fe]'}`}>
              <div className="flex space-x-4 mb-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              </div>
              <div
                ref={mouthRef}
                className="w-8 h-4 bg-rose-500 rounded-full transition-transform duration-75 origin-center"
                style={{ transform: 'scaleY(0.15)' }}
              ></div>
            </div>
            <div className="absolute bottom-2 text-[0.6rem] text-gray-500 font-mono tracking-wider">
              PATHNAME: {pathname}
            </div>
          </div>

          {/* 专属流式对话缓冲区 */}
          <div className="h-48 overflow-y-auto p-4 bg-[#0a0f1d]/80 font-mono text-xs flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`p-2 rounded max-w-[85%] leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-gray-800 text-white self-end text-right' 
                  : msg.isError 
                    ? 'bg-red-900/30 border-l-2 border-red-500 text-red-400 self-start'
                    : 'bg-[#00f2fe]/10 border-l-2 border-[#00f2fe] text-[#00f2fe] self-start'
              }`}>
                {msg.content || '▋'}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* 发射控制台 */}
          <form onSubmit={handleExecuteInference} className="flex border-t border-gray-800 bg-gray-900 p-2 gap-2">
            <input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="向我的大模型分身提问..."
              className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00f2fe] disabled:opacity-50"
              autoComplete="off"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !userPrompt.trim()}
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