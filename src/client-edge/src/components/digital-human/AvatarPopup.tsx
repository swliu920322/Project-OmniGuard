'use client';

import React, { useRef, useEffect } from 'react';
import { Minimize2, Cpu, Cloud } from 'lucide-react';

interface MessageItem {
  role: string;
  content: string;
  isError?: boolean;
  source?: 'local' | 'cloud';
}

interface AvatarPopupProps {
  messages: MessageItem[];
  isTalking: boolean;
  engineStatus: string;
  bootProgress: string;
  userPrompt: string;
  isProcessing: boolean;
  placement: 'br' | 'tr' | 'bl' | 'tl';
  setUserPrompt: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AvatarPopup({
  messages, isTalking, engineStatus, bootProgress, userPrompt, isProcessing, placement, setUserPrompt, onClose, onSubmit
}: AvatarPopupProps) {

  const mouthRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 🟩 Web Audio 动作模拟器：口型共振物理变化
  useEffect(() => {
    let animId: number;
    const frame = () => {
      if (!isTalking) {
        if (mouthRef.current) mouthRef.current.style.transform = 'scaleY(0.15)';
        return;
      }
      const amplitude = Math.random() * 0.85 + 0.15;
      if (mouthRef.current) mouthRef.current.style.transform = `scaleY(${amplitude})`;
      animId = requestAnimationFrame(frame);
    };
    if (isTalking) frame();
    return () => cancelAnimationFrame(animId);
  }, [isTalking]);

  // 根据拖拽象限，流式映射出最完美的物理对账定位夹角
  const getPlacementClass = () => {
    switch (placement) {
      case 'tr': return 'absolute top-16 right-0 origin-top-right'; // 右上 ➔ 向下向左
      case 'bl': return 'absolute bottom-16 left-0 origin-bottom-left'; // 左下 ➔ 向上向右
      case 'tl': return 'absolute top-16 left-0 origin-top-left'; // 左上 ➔ 向下向右
      case 'br':
      default: return 'absolute bottom-16 right-0 origin-bottom-right'; // 右下 ➔ 向上向左
    }
  };

  return (
    <div className={`w-85 sm:w-96 bg-slate-900 border border-[#00f2fe] shadow-[0_25px_60px_rgba(0,0,0,0.7)] rounded-xl overflow-hidden flex flex-col transition-all duration-200 ${getPlacementClass()}`}>

      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 font-mono text-[10px] text-[#00f2fe] tracking-widest uppercase">
        <div className="flex items-center space-x-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${engineStatus === 'HYBRID_READY' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
          <span>HYBRID_CORE // SYS_{engineStatus} {bootProgress}</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <Minimize2 size={13} />
        </button>
      </div>

      {/* 2.5D css 口型画布 */}
      <div className="w-full h-28 bg-gradient-to-b from-slate-800 to-[#0a0f1d] relative flex items-center justify-center border-b border-slate-800">
        <div className={`w-20 h-24 bg-slate-950 rounded-full flex flex-col items-center justify-center border transition-all duration-300 ${isTalking ? 'border-rose-500 scale-105 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'border-[#00f2fe]'}`}>
          <div className="flex space-x-3 mb-2.5">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
          </div>
          <div ref={mouthRef} className="w-6 h-2 bg-rose-500 rounded-full transition-transform duration-75 origin-center scale-y-[0.15]" />
        </div>
      </div>

      {/* 消息历史区 */}
      <div className="h-44 overflow-y-auto p-4 bg-[#0a0f1d]/90 font-mono text-xs flex flex-col gap-2.5">
        {messages.map((msg, idx) => (
          <div key={idx} className={`p-2 rounded max-w-[85%] flex flex-col leading-relaxed ${
            msg.role === 'user' ? 'bg-slate-800 text-white self-end text-right' : 'bg-[#00f2fe]/10 border-l-2 border-[#00f2fe] text-[#00f2fe] self-start'
          }`}>
            <span>{msg.content || '▋'}</span>
            {msg.role === 'ai' && !msg.isError && (
              <span className="text-[8px] text-slate-500 mt-1 flex items-center gap-0.5 font-sans self-end">
                {msg.source === 'local' ? <Cpu size={9} /> : <Cloud size={9} />}
                {msg.source === 'local' ? '本地显存击穿' : '转发新加坡云端'}
              </span>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* 控制台面板 */}
      <form onSubmit={onSubmit} className="flex border-t border-slate-800 bg-slate-900 p-2 gap-2">
        <input
          type="text"
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder={isProcessing ? "解算推演中..." : "输入指令..."}
          className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#00f2fe] disabled:opacity-40"
          disabled={isProcessing}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isProcessing || !userPrompt.trim()}
          className="bg-[#00f2fe] hover:bg-[#00c8d4] disabled:bg-slate-700 text-slate-950 disabled:text-slate-500 font-mono font-bold px-3 text-xs rounded transition-colors"
        >
          SEND
        </button>
      </form>
    </div>
  );
}