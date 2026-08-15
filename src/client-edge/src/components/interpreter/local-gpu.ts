/**
 * Content Interpreter — local GPU reasoning with GRAMMAR-CONSTRAINED output.
 *
 * 关键架构决策：本地模型只用来做【受限选择】，不做自由生成。
 * 通过 web-llm 的 `response_format` grammar 把输出空间锁死在
 * {"preset":"academic"|"playbook"|"narrative"} —— 模型语法上无法
 * 逃逸出合法集合。即使 0.5B 理解力有限，它产出的也一定是合法参数；
 * sanitize 再做语义兜底，双层保险。
 *
 * "AI 在受限域里做决定" —— 这就是 AI+应用 的信任边界。
 */
import { resolveIntent, ruleFallback, ruleHasConfidence, describeSpecEn, type IntentResolution } from './intent-llm';
import { getPreset } from '@omnidocs/interpreter';

const LOCAL_MODEL = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

/** 本地模型调用最长时间（秒）。模型加载/推理挂起时兜底，绝不阻塞 UI。 */
const LOCAL_TIMEOUT_MS = 10000;

/** 整个意图解析的最外层超时 —— 保证 submit 永远 settle，pending 永不卡死。 */
const TOTAL_TIMEOUT_MS = 15000;

/** 穷举锁死输出：preset 三选一。模型没有任何自由生成空间。 */
const PRESET_GRAMMAR = String.raw`
root ::= "{" ws "\"preset\"" ws ":" ws "\"" preset "\"" ws "}"
preset ::= "academic" | "playbook" | "narrative"
ws ::= [ \n\t]*
`;

const SYSTEM_PROMPT = `You are the display parameter router for a document interpreter.
Given the user's intent about their audience, pick the single most fitting document form.
Respond with exactly the requested JSON: {"preset":"academic"} or {"preset":"playbook"} or {"preset":"narrative"}.
Operations staff / runbook / procedures -> playbook.
Executive / narrative / story / presentation -> narrative.
Review / academic / bilingual formal doc -> academic.
Output ONLY the JSON, nothing else.`;

let engine: any = null;
let initPromise: Promise<any> | null = null;

async function getEngine(onProgress?: (p: number) => void): Promise<any> {
  if (typeof window === 'undefined' || !('gpu' in navigator)) return null;
  if (!engine) {
    if (!initPromise) {
      const webLLM = await import('@mlc-ai/web-llm');
      initPromise = webLLM.CreateMLCEngine(LOCAL_MODEL, {
        initProgressCallback: (report: any) => onProgress?.(Math.round(report.progress * 100)),
      });
    }
    engine = await initPromise;
  }
  return engine;
}

/** 带超时护栏的 Promise：超时后 resolve(fallback)，绝不挂起，且清理 timer。 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(fallback);
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * 本地受限决策：返回用户意图对应的 preset，且保证合法。
 * 失败/超时 → null，调用方降级到规则引擎。绝不挂起。
 */
export async function localPresetDecision(intent: string): Promise<string | null> {
  try {
    return await withTimeout(localPresetDecisionInner(intent), LOCAL_TIMEOUT_MS, null);
  } catch (err) {
    console.warn('[LocalGPU] constrained decision failed:', err);
    return null;
  }
}

async function localPresetDecisionInner(intent: string): Promise<string | null> {
  const e = await getEngine();
  if (!e) return null;
  const reply = await e.chatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: intent },
    ],
    temperature: 0,
    max_tokens: 48,
    response_format: { type: 'grammar', grammar: PRESET_GRAMMAR },
  });
  const text: string = reply?.choices?.[0]?.message?.content ?? '';
  const m = text.match(/"preset"\s*:\s*"(academic|playbook|narrative)"/);
  return m ? m[1] : null;
}

/**
 * 统一入口。核心原则：**确定性规则是权威，模型只在规则不确定时被咨询。**
 *
 * 教训：0.5B 模型即使 grammar 锁死输出，也只会自信地吐"academic"（弱模型
 * 挑默认项）。若让模型跑在规则前面，它会用错误决定覆盖正确规则。
 *
 * 策略：
 * 1) 规则有明确命中（运维/汇报/评审等关键词）→ 直接采用，绝不咨询模型
 * 2) 规则不确定（默认 academic）→ 才咨询本地/云端模型，结果经 sanitize 落地
 * 3) 模型失败 → 保持规则兜底
 * 任何路径永不挂起（withTimeout），pending 永不卡死。
 */
export async function resolveIntentLocalFirst(intent: string): Promise<IntentResolution> {
  // 规则引擎先跑，且判断是否"有把握"
  const ruleResult = ruleFallback(intent);

  // 1) 规则有把握 → 权威，直接返回（0.5B 模型没有资格覆盖确定性规则）
  if (ruleHasConfidence(intent)) {
    return ruleResult;
  }

  // 2) 规则不确定 → 才咨询模型（本地受限 → 云端），模型失败用规则兜底
  const fallback = ruleResult;
  try {
    const result = await withTimeout<IntentResolution | null>(
      resolveIntentLocalFirstInner(intent),
      TOTAL_TIMEOUT_MS,
      null,
    );
    return result ?? fallback;
  } catch (err) {
    console.warn('[Intent] resolution failed, using rules fallback:', err);
    return fallback;
  }
}

async function resolveIntentLocalFirstInner(intent: string): Promise<IntentResolution> {
  // T1: 本地受限模型
  const preset = await localPresetDecision(intent);
  if (preset) {
    const spec = getPreset(preset);
    return { spec, description: describeSpecEn(spec), mode: 'llm', matched: `local model · ${preset}` };
  }

  // T2: 云端 JSON（sanitize 兜底），云端失败时内部规则保底
  return resolveIntent(intent);
}

export { getEngine as bootLocalEngine };