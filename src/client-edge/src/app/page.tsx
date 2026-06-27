'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Cloud, Copy, Layers, Play, Power, ShieldCheck, Terminal, Trash2, Wand2 } from 'lucide-react';
import {
  LAUNCH_PROFILES,
  LaunchConfig,
  LaunchProfileId,
  getLaunchConfigDefaults,
  loadLaunchConfig,
  saveLaunchConfig,
  saveLaunchProfile,
} from '@/lib/launchProfile';

type LogTone = 'info' | 'success' | 'warn' | 'error';

interface LogItem {
  id: number;
  tone: LogTone;
  text: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatConfigCommand(config: LaunchConfig) {
  const base = [
    `AZURE_SUBSCRIPTION="${config.azureSubscription || '<your-subscription>'}"`,
    `AZURE_OPENAI_RESOURCE_GROUP="${config.azureResourceGroup || '<rg>'}"`,
    `AZURE_OPENAI_ACCOUNT_NAME="${config.azureOpenAiAccountName || '<account>'}"`,
    `AZURE_OPENAI_DEPLOYMENT_NAME="${config.azureDeploymentName}"`,
  ];

  return [...base, './sh/start.sh'].join(' ');
}

function formatDestroyCommand() {
  return `./sh/destroy.sh`;
}

export default function StartupConsolePage() {
  const [config, setConfig] = useState<LaunchConfig>(() => getLaunchConfigDefaults('local-sub-thirdparty-openai'));
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [copiedHint, setCopiedHint] = useState('');

  useEffect(() => {
    const loaded = loadLaunchConfig();
    setConfig(loaded);
    setLogs([
      { id: 1, tone: 'info', text: '启动台已就绪：先选模式，再启动或销毁 Bicep 资源。' },
      { id: 2, tone: 'info', text: '履历页已独立为 /resume，IaC 画布位于 /iac。' },
    ]);
  }, []);

  const activeProfile = LAUNCH_PROFILES[config.profileId];

  const startCommand = useMemo(() => formatConfigCommand(config), [config]);
  const destroyCommand = useMemo(() => formatDestroyCommand(), []);

  const appendLog = (tone: LogTone, text: string) => {
    setLogs((prev) => [...prev, { id: Date.now() + Math.random(), tone, text }]);
  };

  const persistConfig = (next: LaunchConfig) => {
    setConfig(next);
    saveLaunchProfile(next.profileId as LaunchProfileId);
    saveLaunchConfig(next);
  };

  const onSelectProfile = (profileId: LaunchProfileId) => {
    const defaults = getLaunchConfigDefaults(profileId);
    const next: LaunchConfig = {
      ...defaults,
      profileId,
      aiProvider: LAUNCH_PROFILES[profileId].aiProvider,
      azureDeploymentName: config.azureDeploymentName || defaults.azureDeploymentName,
      azureSubscription: config.azureSubscription,
      azureResourceGroup: config.azureResourceGroup,
      azureOpenAiAccountName: config.azureOpenAiAccountName,
    };
    persistConfig(next);
    appendLog('info', `已切换启动模式：${LAUNCH_PROFILES[profileId].title}`);
  };

  const handleStart = async () => {
    setBusy(true);
    setLogs([]);
    appendLog('info', '生成启动命令...');
    await sleep(220);
    appendLog('info', `当前模式：${activeProfile.title}`);
    await sleep(220);
    appendLog('info', `Azure Deployment: ${config.azureDeploymentName || activeProfile.defaultDeploymentName}`);
    await sleep(220);
    appendLog('success', 'OpenAI 配置已从 local.settings.json 读取，不再通过前端下发。');
    await sleep(220);
    appendLog('warn', '提示：真正的 Azure 资源创建建议在终端执行命令。');
    await sleep(180);
    appendLog('info', startCommand);
    setBusy(false);
  };

  const handleDestroy = async () => {
    setBusy(true);
    setLogs([]);
    appendLog('warn', '销毁流程已触发：请先确认是否需要回收全部 Bicep 资源。');
    await sleep(220);
    appendLog('warn', '将执行的命令预览如下：');
    await sleep(220);
    appendLog('error', destroyCommand);
    await sleep(220);
    appendLog('info', '如果要真正删除资源，请在终端中执行上述命令。');
    setBusy(false);
  };

  const copyText = async (text: string, hint: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedHint(hint);
    window.setTimeout(() => setCopiedHint(''), 1400);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 md:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[#00f2fe] text-xs uppercase tracking-[0.35em] font-mono flex items-center gap-2">
                <Terminal size={12} /> BICEP_STARTUP_CONSOLE
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mt-2">
                启动台：配置、启动日志、销毁入口
              </h1>
              <p className="text-sm text-slate-400 mt-3 max-w-4xl leading-relaxed">
                这个页面只负责“先配置，再启动，再看日志”，并提供一键回收 Bicep 资源的命令预览。履历已经拆到 <Link className="text-[#00f2fe] underline" href="/resume">/resume</Link>，Bicep 模板最佳实践在 <Link className="text-[#00f2fe] underline" href="/iac">/iac</Link>。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/resume" className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:border-[#00f2fe] transition-colors text-sm font-mono inline-flex items-center gap-2">
                查看履历 <ArrowRight size={14} />
              </Link>
              <Link href="/iac" className="px-4 py-2 rounded-xl bg-[#00f2fe] hover:bg-[#00c8d4] text-slate-950 transition-colors text-sm font-mono font-bold inline-flex items-center gap-2">
                进入 IaC Hub <Layers size={14} />
              </Link>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500 font-mono flex items-center gap-2">
                  <ShieldCheck size={12} /> PROFILE_MATRIX
                </div>
                <h2 className="text-xl font-bold text-white mt-2">启动模式</h2>
              </div>
              <span className="text-xs font-mono rounded-full border border-slate-700 px-3 py-1 text-slate-400">
                当前：{activeProfile.title}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.values(LAUNCH_PROFILES).map((profile) => {
                const selected = profile.id === config.profileId;
                return (
                  <button
                    key={profile.id}
                    onClick={() => onSelectProfile(profile.id)}
                    className={`text-left rounded-2xl border p-4 transition-all duration-200 ${selected ? 'border-[#00f2fe] bg-[#00f2fe]/10' : 'border-slate-800 bg-slate-950/70 hover:border-slate-600'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs uppercase tracking-[0.25em] text-slate-500 font-mono">{profile.subscriptionScope}</div>
                      <div className={`text-[10px] font-mono px-2 py-1 rounded-full border ${selected ? 'border-[#00f2fe] text-[#00f2fe]' : 'border-slate-700 text-slate-500'}`}>
                        {selected ? 'ACTIVE' : 'SELECT'}
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-white mt-3">{profile.title}</h3>
                    <p className="text-xs text-[#00f2fe] mt-1">{profile.subtitle}</p>
                    <p className="text-sm text-slate-400 mt-3 leading-relaxed">{profile.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Azure 订阅"
                value={config.azureSubscription}
                placeholder="可选：AZURE_SUBSCRIPTION"
                onChange={(value) => persistConfig({ ...config, azureSubscription: value })}
              />
              <Field
                label="Azure 资源组"
                value={config.azureResourceGroup}
                placeholder="例如：omni-guard-infra-sea-rg"
                onChange={(value) => persistConfig({ ...config, azureResourceGroup: value })}
              />
              <Field
                label="Azure OpenAI 账户名"
                value={config.azureOpenAiAccountName}
                placeholder="例如：southeastaisa-0322-resource"
                onChange={(value) => persistConfig({ ...config, azureOpenAiAccountName: value })}
              />
              <Field
                label="Azure Deployment Name"
                value={config.azureDeploymentName}
                placeholder="常见值：gpt-4o"
                onChange={(value) => persistConfig({ ...config, azureDeploymentName: value })}
              />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <Wand2 size={14} className="text-[#00f2fe]" /> 启动命令预览
                </div>
                <button onClick={() => copyText(startCommand, '启动命令已复制')} className="text-xs font-mono text-[#00f2fe] flex items-center gap-1">
                  <Copy size={12} /> 复制
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap">{startCommand}</pre>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleStart}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-slate-950 font-mono font-bold inline-flex items-center gap-2"
              >
                <Play size={14} /> 启动并写入日志
              </button>
              <button
                onClick={handleDestroy}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white font-mono font-bold inline-flex items-center gap-2"
              >
                <Trash2 size={14} /> 销毁 Bicep 资源预览
              </button>
              <Link href="/iac/canvas" className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:border-[#00f2fe] transition-colors font-mono inline-flex items-center gap-2">
                <Layers size={14} /> 进入 Bicep 画布
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500 font-mono flex items-center gap-2">
                <Cloud size={12} /> LIVE_LOG_STREAM
              </div>
              <h2 className="text-xl font-bold text-white mt-2">启动日志</h2>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-500 flex items-center gap-2">
                  <Terminal size={14} /> 等待点击“启动并写入日志”
                </div>
              ) : logs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-xl border p-3 text-xs font-mono leading-relaxed ${toneClasses(log.tone)}`}
                >
                  {log.text}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <Power size={14} className="text-[#00f2fe]" /> 销毁命令
                </div>
                <button onClick={() => copyText(destroyCommand, '销毁命令已复制')} className="text-xs font-mono text-[#00f2fe] flex items-center gap-1">
                  <Copy size={12} /> 复制
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap">{destroyCommand}</pre>
            </div>

            <div className="rounded-2xl border border-amber-600/30 bg-amber-500/10 p-4 text-sm text-amber-100 flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">当前页面不直接执行破坏性操作</div>
                <div className="text-amber-100/80 mt-1">点击销毁只会生成命令与日志，真正删除资源仍建议在终端确认执行。</div>
                {copiedHint ? <div className="text-[#00f2fe] mt-2 text-xs font-mono">{copiedHint}</div> : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-500 font-mono">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00f2fe]"
      />
    </label>
  );
}

function toneClasses(tone: LogTone) {
  switch (tone) {
    case 'success': return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
    case 'warn': return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    case 'error': return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
    default: return 'border-slate-700 bg-slate-950/70 text-slate-200';
  }
}

