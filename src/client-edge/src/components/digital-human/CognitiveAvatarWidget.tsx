'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Send, MessageSquare, Minimize2, Cpu, Cloud, RefreshCw } from 'lucide-react';

// =========================================================================
// 🔒 模块级静态单例：彻底脱离 React 生命周期，死锁 WASM 堆栈
// =========================================================================
let globalLLMEngine: any = null;
let globalLLMInitPromise: Promise<any> | null = null;
let globalEmbeddingPipeline: any = null;
let globalEmbeddingInitPromise: Promise<any> | null = null;

const LOCAL_MODEL_NAME = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

// =========================================================================
// 🧱 本地知识资产网格 (自然语言化洗净版，完美咬合句子向量空间)
// =========================================================================
interface LocalKnowledgeNode {
  tags: string;
  text: string;
  vector?: number[];
}

const LOCAL_KNOWLEDGE_BASE: LocalKnowledgeNode[] = [
  { tags: "你好，最近怎么样？日常打招呼与寒暄问候。hello hi greeting", text: "你好！我是胜伟的本地边缘算力分身。检测到这是一发高频寒暄，已通过您 Mac 浏览器原生的 WebGPU 硬件加速通道完成就地解算，零云端资费秒回！" },
  { tags: "刘胜伟目前的学历是什么？他在哪家学校读硕士？什么时候毕业？Taylor University Master Computing AI", text: "刘胜伟目前在马来西亚泰莱大学（Taylor's University）攻读应用计算硕士（AI方向），主攻企业级 RAG 沙盘与多智能体编排，预计 2026 年 8 月底满血毕业。" },
  { tags: "介绍一下他的工作履历和经验年限。他在埃森哲带过团队吗？Accenture Scania Lead Engineer Manager", text: "他具备 10 年以上的全栈工程交付与核心架构底蕴。曾任埃森哲（Accenture）技术交付主管，精通微前端隔离与运行时复杂状态机的研发，擅长攻坚高负载系统。" },
  { tags: "他考取了哪些微软官方专家认证和认证证书？az305 az104 ai102 Solutions Architect Microsoft Certified", text: "他已满血斩获微软官方顶级证书矩阵：AZ-305 (Azure Solutions Architect Expert) 专家架构师、AZ-104 (微软系统管理员) 以及 AI-102 (Azure AI 工程师专家认证)。" }
];

// =========================================================================
// 🚦 边缘数学级算力管道 (The Pristine Utility Functions)
// =========================================================================

function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return normA === 0 || normB === 0 ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 路由解算器：盘点本地 RAG 资产边界 (自愈版)
 */
async function evaluateLocalRAGContext(prompt: string): Promise<{ hasKnowledge: boolean; localContext: string }> {
  const lower = prompt.toLowerCase().trim();

  // 🟩 🚀 【核心绝杀】：前置字面量闪电通道 (Literal Fast-Pass)。日常极简寒暄 0ms 直接强行留置本地
  const fastPassTokens = ["你好", "hello", "hi", "嗨", "最近怎么样"];
  const isHitFastPass = fastPassTokens.some(token => lower === token || lower.startsWith(token));

  if (isHitFastPass) {
    console.log("[Router Console] 🚀 Literal Fast-Pass Triggered. Directing to WebGPU.");
    return { hasKnowledge: true, localContext: LOCAL_KNOWLEDGE_BASE[0].text };
  }

  // 异常防御边界：如果向量盾还没完全开机，早期安全返回结构对账
  if (!globalEmbeddingPipeline) {
    return { hasKnowledge: false, localContext: '' };
  }

  try {
    const output = await globalEmbeddingPipeline(prompt, { pooling: 'mean', normalize: true });
    const promptVector = Array.from(output.data) as number[];

    let maxSimilarity = -1;
    let matchedAsset = "";

    for (const node of LOCAL_KNOWLEDGE_BASE) {
      if (!node.vector) continue;
      const similarity = computeCosineSimilarity(promptVector, node.vector);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        matchedAsset = node.text;
      }
    }

    console.log(`[Semantic Router Matrix] Max Cosine Similarity Determined: ${maxSimilarity.toFixed(4)}`);

    const SEMANTIC_THRESHOLD = 0.72;
    return {
      hasKnowledge: maxSimilarity >= SEMANTIC_THRESHOLD,
      localContext: maxSimilarity >= SEMANTIC_THRESHOLD ? matchedAsset : ''
    };
  } catch (err) {
    console.error("[Semantic Router Interruption]", err);
    return { hasKnowledge: false, localContext: '' };
  }
}

async function runLocalGPUPipeline(prompt: string, context: string, onToken: (token: string) => void): Promise<void> {
  if (!globalLLMEngine) throw new Error("Local GPU Kernel Absent");

  const chunks = await globalLLMEngine.chat.completions.create({
    messages: [
      { role: "system", content: `You are Shengwei's local assistant. Answer strictly based on this fact: ${context}` },
      { role: "user", content: prompt }
    ],
    stream: true,
  });

  for await (const chunk of chunks) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) onToken(delta);
  }
}

async function cloudInferencePipeline(prompt: string, pathname: string, onToken: (token: string) => void): Promise<void> {
  const base = process.env.NODE_ENV === 'development' ? 'http://localhost:7071' : '';
  const response = await fetch(`${base}/api/chat/stream?t=${Date.now()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prompt, context: pathname })
  });

  if (!response.ok) throw new Error(`Remote API Aborted: ${response.status}`);
  if (!response.body) throw new Error('No stream channel exposed');

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
// 🎨 UI 表现与总线调度视图组件 (Persistent Layout Guard)
// =========================================================================
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

  const mouthRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function secureSystemBoot() {
      if (!navigator.gpu) {
        if (isMounted) setEngineStatus('CLOUD_ONLY');
        return;
      }

      try {
        const transformersModule = await import('@huggingface/transformers');
        const webLLMModule = await import('@mlc-ai/web-llm');

        if (!globalEmbeddingPipeline) {
          if (!globalEmbeddingInitPromise) {
            globalEmbeddingInitPromise = transformersModule.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
          }
          globalEmbeddingPipeline = await globalEmbeddingInitPromise;

          for (const node of LOCAL_KNOWLEDGE_BASE) {
            if (!node.vector) {
              const res = await globalEmbeddingPipeline(node.tags, { pooling: 'mean', normalize: true });
              node.vector = Array.from(res.data) as number[];
            }
          }
        }

        if (!globalLLMEngine) {
          if (!globalLLMInitPromise) {
            globalLLMInitPromise = webLLMModule.CreateMLCEngine(LOCAL_MODEL_NAME, {
              initProgressCallback: (report) => {
                if (isMounted) {
                  setBootProgress(`${Math.round(report.progress * 100)}%`);
                  setMessages([{ role: 'ai', content: `正在向 Mac 统一内存倾泻本地模型包: ${Math.round(report.progress * 100)}% ...`, source: 'local' }]);
                }
              }
            });
          }
          globalLLMEngine = await globalLLMInitPromise;
        }

        if (isMounted) {
          setEngineStatus('HYBRID_READY');
          setMessages([{ role: 'ai', content: '你好！我是胜伟的 AI 虚拟分身。本地语义向量盾与 WebGPU 显存大模型已完全对接通车。输入“你好”、“学历”或“证书”将 100% 留置本地显卡自愈，其余复杂技术博弈将由远端 OpenAI 协同。', source: 'local' }]);
        }
      } catch (err) {
        console.error("[Critical Hardware Initiation Aborted]", err);
        if (isMounted) {
          setEngineStatus('CLOUD_ONLY');
          setMessages([{ role: 'ai', content: '本地边缘算力自检失败，全量计算主权已平滑降级移交至远端大模型中枢。', source: 'cloud' }]);
        }
      }
    }

    secureSystemBoot();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsTalking(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    let contextNotice = '已为您切换页面。本地 RAG 特征盾已重置，随时扫描您的提问。';
    if (pathname === '/') {
      contextNotice = '您已回到履历主页面。日常寒暄与基础死简历将由本地 WebGPU 秒回；提问核心项目深水区，流量自动出海。';
    } else if (pathname.includes('/canvas')) {
      contextNotice = '进驻 Module Beta 智能画布空间。全套 Bicep 自动化与虚网物理边界知识库已并轨就绪。';
    }
    setMessages([{ role: 'ai', content: contextNotice, source: 'local' }]);
  }, [pathname]);

  const triggerAudioMouthSync = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.includes('SG') || v.lang.includes('US')) || null;
    utterance.rate = 1.05;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const frameLoop = () => {
      if (!isTalking) {
        if (mouthRef.current) mouthRef.current.style.transform = 'scaleY(0.15)';
        return;
      }
      const amplitude = Math.random() * 0.85 + 0.15;
      if (mouthRef.current) mouthRef.current.style.transform = `scaleY(${amplitude})`;
      animationRef.current = requestAnimationFrame(frameLoop);
    };

    utterance.onstart = () => { setIsTalking(true); frameLoop(); };
    utterance.onend = () => {
      setIsTalking(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mouthRef.current) mouthRef.current.style.transform = 'scaleY(0.15)';
    };
    window.speechSynthesis.speak(utterance);
  };

  const handleExecuteInference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim() || isProcessing) return;

    const currentInput = userPrompt.trim();
    setUserPrompt('');
    setIsProcessing(true);

    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);

    // 1. 🔍 动态解算分流决策
    const decision = await evaluateLocalRAGContext(currentInput);
    const targetSource = decision.hasKnowledge ? 'local' : 'cloud';

    setMessages(prev => [...prev, { role: 'ai', content: '', source: targetSource }]);

    let dynamicUIBuffer = "";
    const updateUIFrame = (token: string) => {
      dynamicUIBuffer += token;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = dynamicUIBuffer;
        return updated;
      });
    };

    // 🟩 轨道 A：本地拦截成功且 WebGPU 引擎就绪 ➔ 留在显存里流式喷涌 Token
    if (decision.hasKnowledge && engineStatus === 'HYBRID_READY') {
      try {
        await runLocalGPUPipeline(currentInput, decision.localContext, updateUIFrame);
        if (dynamicUIBuffer.trim()) triggerAudioMouthSync(dynamicUIBuffer);
        setIsProcessing(false);
        return;
      } catch (err) {
        console.error("本地计算期异常，级联降级上云:", err);
        setMessages(prev => {
          const sync = [...prev];
          sync[sync.length - 1].source = 'cloud';
          return sync;
        });
      }
    }

    // 🟩 轨道 B：本地资产踩空 ➔ Forward 转发给新加坡大模型
    try {
      updateUIFrame("本地 RAG 资产未命中该领域，正在跨海向新加坡云端大模型转发流量...▋");

      await cloudInferencePipeline(currentInput, pathname, (token) => {
        if (dynamicUIBuffer === "本地 RAG 资产未命中该领域，正在跨海向新加坡云端大模型转发流量...▋") {
          dynamicUIBuffer = "";
        }
        updateUIFrame(token);
      });

      if (dynamicUIBuffer.trim()) triggerAudioMouthSync(dynamicUIBuffer);
    } catch (error) {
      console.error(error);
      setMessages(prev => {
        const errorList = [...prev];
        errorList[errorList.length - 1].content = '远端计算节点连线失联，请确认本地后端 func start 是否正常供电。';
        errorList[errorList.length - 1].isError = true;
        return errorList;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans text-slate-200">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-emerald-400 hover:from-cyan-600 hover:to-emerald-500 active:scale-95 text-slate-950 font-bold rounded-full shadow-[0_10px_30px_rgba(0,242,254,0.3)] flex items-center justify-center border border-slate-950 transition-all duration-200"
        >
          <MessageSquare size={24} className="text-slate-950" />
        </button>
      )}

      {isOpen && (
        <div className="w-85 sm:w-96 bg-gray-900 border border-[#00f2fe] shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-xl overflow-hidden flex flex-col transition-all animate-in fade-in slide-in-from-bottom-8 duration-200">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800">
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${engineStatus === 'HYBRID_READY' ? 'bg-emerald-400 animate-pulse' : engineStatus === 'BOOTING' ? 'bg-amber-400' : 'bg-red-500'}`}></span>
              <span className="text-[10px] font-mono text-[#00f2fe] tracking-widest uppercase flex items-center gap-1">
                {engineStatus === 'BOOTING' && <RefreshCw size={10} className="animate-spin" />}
                HYBRID_RAG_GRID // SYS_{engineStatus} {bootProgress}
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
              PATH_NODE: {pathname.toUpperCase()}
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
                    {msg.source === 'local' ? '本地显存 RAG 击穿' : '转发新加坡云端大模型'}
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
              placeholder={isProcessing ? "数据链推演中..." : engineStatus === 'BOOTING' ? "正在向显存倒灌模型..." : "输入指令..."}
              className="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00f2fe] disabled:opacity-40"
              autoComplete="off"
              disabled={isProcessing || engineStatus === 'BOOTING'}
            />
            <button
              type="submit"
              disabled={isProcessing || !userPrompt.trim() || engineStatus === 'BOOTING'}
              className="bg-[#00f2fe] hover:bg-[#00c8d4] disabled:bg-gray-600 text-[#0a0f1d] disabled:text-gray-600 font-bold px-4 rounded transition-colors flex items-center justify-center"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}