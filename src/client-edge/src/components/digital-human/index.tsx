'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Draggable from 'react-draggable'; // 高性能拖拽底座
import { MessageSquare } from 'lucide-react';
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

  // 弹窗象限阵位
  const [placement, setPlacement] = useState<'br' | 'tr' | 'bl' | 'tl'>('br');

  const widgetRef = useRef<HTMLDivElement>(null);

  // 🎯【新增意图锁防线】：死锁长按与点击的物理穿透阻尼
  const isDragging = useRef(false);
  const clickBlocker = useRef(false);

  const handleRecalculateQuadrant = () => {
    if (!widgetRef.current) return;
    const rect = widgetRef.current.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const isLeftHalf = centerX < screenWidth / 2;
    const isTopHalf = centerY < screenHeight / 2;

    if (!isLeftHalf && !isTopHalf) setPlacement('br');
    else if (!isLeftHalf && isTopHalf) setPlacement('tr');
    else if (isLeftHalf && !isTopHalf) setPlacement('bl');
    else if (isLeftHalf && isTopHalf) setPlacement('tl');
  };

  // 微内核引导
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

  // 软路由路径监听
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

  // 🟩 5. 阻断点击流控：点击按键激活门禁
  const handleBallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // 如果门禁锁或长按锁处于闭锁状态，刚性截断事件，不准展开弹窗
    if (clickBlocker.current || isDragging.current) {
      return;
    }

    if (!isOpen) {
      setIsOpen(true);
      setTimeout(handleRecalculateQuadrant, 50);
    }
  };

  return (
    <Draggable
      nodeRef={widgetRef}
      delay={150} // 150ms 缓动引信
      onStart={() => {
        isDragging.current = false; // 引导启动
      }}
      onDrag={() => {
        isDragging.current = true; // 发生物理位移，锁死长按状态
      }}
      onStop={() => {
        handleRecalculateQuadrant();
        if (isDragging.current) {
          // 🎯【绝杀穿透】：如果是长放，释放瞬间闭锁点击闸门 80 毫秒，物理洗净残余冒泡
          clickBlocker.current = true;
          const timer = setTimeout(() => {
            clickBlocker.current = false;
            isDragging.current = false;
          }, 80);
          return () => clearTimeout(timer);
        }
      }}
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
            onClose={() => {
              setIsOpen(false);
              setTimeout(handleRecalculateQuadrant, 50);
            }}
            onSubmit={handleExecuteInference}
          />
        )}

        {/* 🚦 变换形态自愈小球 */}
        {/* 💡 移除指针事件阻断，交由受控的 handleBallClick 集中调度 */}
        <button
          onPointerDown={(e) => e.stopPropagation()} // 刚性拦截拖拽组件原生的多余事件冒泡
          onClick={handleBallClick}
          className={`w-14 h-14 bg-gradient-to-tr from-cyan-500 to-emerald-400 hover:from-cyan-600 hover:to-emerald-500 
            text-slate-950 font-bold rounded-full shadow-[0_10px_30px_rgba(0,242,254,0.3)] 
            flex items-center justify-center border border-slate-950 cursor-grab active:cursor-grabbing
            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
            ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
        >
          <MessageSquare size={20} className="text-slate-950" />
        </button>

      </div>
    </Draggable>
  );
}