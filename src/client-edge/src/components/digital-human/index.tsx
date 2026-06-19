'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Draggable from 'react-draggable'; // 物理挂载高性能自由拖拽引擎
import { MessageSquare, Move } from 'lucide-react';
import AvatarPopup from './AvatarPopup';
import { bootEdgeComputeKernel, evaluateLocalRAGContext, runLocalGPUPipeline, cloudInferencePipeline } from './kernel';

export default function CognitiveAvatarWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string; isError?: boolean; source?: 'local' | 'cloud' }[]>([
    { role: 'ai', content: '双轨多活调度中枢正在热引导硬件平面...', source: 'local' }
  ]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [engineStatus, setEngineStatus] = useState<'BOOTING' | 'HYBRID_READY' | 'CLOUD_ONLY'>('BOOTING');
  const [bootProgress, setBootProgress] = useState('');

  // 🎯 弹窗象限状态：'br'(右下), 'tr'(右上), 'bl'(左下), 'tl'(左上)
  const [placement, setPlacement] = useState<'br' | 'tr' | 'bl' | 'tl'>('br');

  const widgetRef = useRef<HTMLDivElement>(null);

  // 🟩 1. 物理象限空间检测引信：松开鼠标刹那，重写弹窗阵位，永远往开阔方向弹射
  const handleRecalculateQuadrant = () => {
    if (!widgetRef.current) return;
    const rect = widgetRef.current.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const isLeftHalf = centerX < screenWidth / 2;
    const isTopHalf = centerY < screenHeight / 2;

    if (!isLeftHalf && !isTopHalf) setPlacement('br');      // 右下 ➔ 向上向左展
    else if (!isLeftHalf && isTopHalf) setPlacement('tr');   // 右上 ➔ 向下向左展
    else if (isLeftHalf && !isTopHalf) setPlacement('bl');   // 左下 ➔ 向上向右展
    else if (isLeftHalf && isTopHalf) setPlacement('tl');    // 左上 ➔ 向下向右展
  };

  // 🟩 2. 微内核开机点火
  useEffect(() => {
    let isMounted = true;
    bootEdgeComputeKernel((prog) => {
      if (isMounted) setBootProgress(`${prog}%`);
    }).then((success) => {
      if (!isMounted) return;
      if (success) {
        setEngineStatus('HYBRID_READY');
        setMessages([{ role: 'ai', content: '你好！我是胜伟的 AI 虚拟分身。本地语义向量盾与 WebGPU 显存大模型已完全对接通车。寒暄、学历或证书将 100% 留置本地显卡自愈，其余复杂技术博弈将由远端 OpenAI 协同。', source: 'local' }]);
      } else {
        setEngineStatus('CLOUD_ONLY');
        setMessages([{ role: 'ai', content: '本地边缘算力自检踩空，全量计算主权已平滑降级移交至远端新加坡大模型中枢。', source: 'cloud' }]);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // 🟩 3. 跨页面软路由断连刷新守护
  useEffect(() => {
    window.speechSynthesis.cancel(); setIsTalking(false);
    let notice = '已为您切换页面。本地 RAG 特征盾已重置，随时扫描您的提问。';
    if (pathname === '/') {
      notice = '您已回到履历主页面。日常寒暄与基础简历将由本地 WebGPU 秒回；提问核心项目深水区，流量自动出海。';
    } else if (pathname.includes('/iac')) {
      notice = '进驻分布式 IaC 方案空间。多文件 Bicep 自动化与调用链符号对账库已并轨就绪。';
    }
    setMessages([{ role: 'ai', content: notice, source: 'local' }]);
  }, [pathname]);

  const triggerAudioTTS = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.includes('SG') || v.lang.includes('US')) || null;
    utterance.rate = 1.05;
    utterance.onstart = () => setIsTalking(true);
    utterance.onend = () => setIsTalking(false);
    window.speechSynthesis.speak(utterance);
  };

  // 🟩 4. 双轨总线流控中心
  const handleExecuteInference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim() || isProcessing) return;

    const currentInput = userPrompt.trim();
    setUserPrompt('');
    setIsProcessing(true);
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);

    const decision = await evaluateLocalRAGContext(currentInput);
    const targetSource = decision.hasKnowledge ? 'local' : 'cloud';
    setMessages(prev => [...prev, { role: 'ai', content: '', source: targetSource }]);

    let dynamicUIBuffer = "";
    const updateUIFrame = (token: string) => {
      dynamicUIBuffer += token;
      setMessages(prev => {
        const updated = [...prev]; updated[updated.length - 1].content = dynamicUIBuffer; return updated;
      });
    };

    if (decision.hasKnowledge && engineStatus === 'HYBRID_READY') {
      try {
        await runLocalGPUPipeline(currentInput, decision.localContext, updateUIFrame);
        if (dynamicUIBuffer.trim()) triggerAudioTTS(dynamicUIBuffer);
        setIsProcessing(false); return;
      } catch (err) {
        setMessages(prev => { const sync = [...prev]; sync[sync.length - 1].source = 'cloud'; return sync; });
      }
    }

    try {
      updateUIFrame("本地 RAG 资产未命中该领域，正在跨海向新加坡云端大模型转发流量...▋");
      await cloudInferencePipeline(currentInput, pathname, (token) => {
        if (dynamicUIBuffer === "本地 RAG 资产未命中该领域，正在跨海向新加坡云端大模型转发流量...▋") dynamicUIBuffer = "";
        updateUIFrame(token);
      });
      if (dynamicUIBuffer.trim()) triggerAudioTTS(dynamicUIBuffer);
    } catch (error) {
      setMessages(prev => {
        const errs = [...prev]; errs[errs.length - 1].content = '远端计算节点连线断层，请确认本地后端 func start 是否正常供电。'; errs[errs.length - 1].isError = true; return errs;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    // nodeRef 锁死当前容器，handle 指定必须拖动小十字图标，规避输入框聚焦冲突
    <Draggable
      nodeRef={widgetRef}
      handle=".drag-handle-trigger"
      onStop={handleRecalculateQuadrant}
      defaultPosition={{ x: 0, y: 0 }}
    >
      <div
        ref={widgetRef}
        className="fixed bottom-6 right-6 z-50 font-sans text-slate-200 flex flex-col items-center select-none"
      >
        {/* 🎨 独立抽离的受控展示视窗 */}
        {isOpen && (
          <AvatarPopup
            messages={messages}
            isTalking={isTalking}
            engineStatus={engineStatus}
            bootProgress={bootProgress}
            userPrompt={userPrompt}
            isProcessing={isProcessing}
            placement={placement}
            setUserPrompt={setUserPrompt}
            onClose={() => setIsOpen(false)}
            onSubmit={handleExecuteInference}
          />
        )}

        {/* 🚦 带手柄的物理控制挂件 */}
        <div className="flex flex-col items-center gap-1 group">
          <div className="drag-handle-trigger cursor-move opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 p-1 rounded-full shadow-2xl flex items-center justify-center text-cyan-400">
            <Move size={10} />
          </div>
          <button
            onClick={() => { setIsOpen(!isOpen); setTimeout(handleRecalculateQuadrant, 60); }}
            className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-emerald-400 hover:from-cyan-600 hover:to-emerald-500 text-slate-950 font-bold rounded-full shadow-[0_10px_30px_rgba(0,242,254,0.3)] flex items-center justify-center border border-slate-950 active:scale-95 transition-transform duration-150"
          >
            <MessageSquare size={20} className="text-slate-950" />
          </button>
        </div>

      </div>
    </Draggable>
  );
}