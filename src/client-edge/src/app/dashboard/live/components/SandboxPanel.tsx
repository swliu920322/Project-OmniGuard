// Prompt override controls for the live page.
"use client";

import { useI18n } from "@/components/I18nProvider";

export interface SandboxPanelProps {
  routerPrompt: string;
  setRouterPrompt: (value: string) => void;
  safetyRules: string;
  setSafetyRules: (value: string) => void;
  executionSchema: string;
  setExecutionSchema: (value: string) => void;
}

export default function SandboxPanel({
  routerPrompt,
  setRouterPrompt,
  safetyRules,
  setSafetyRules,
  executionSchema,
  setExecutionSchema,
}: SandboxPanelProps) {
  const { t } = useI18n();
  return (
    <div className="border border-slate-900 bg-slate-950/70 backdrop-blur-sm rounded-xl p-5 space-y-4 shadow-inner shadow-black/80">
      <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-cyan-400 flex items-center space-x-2">
        <span>🛠️ {t("live.sandbox.title")}</span>
        <span className="text-[10px] text-slate-500 normal-case font-normal">{t("live.sandbox.sub")}</span>
      </h3>

      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-mono font-bold uppercase text-slate-500">{t("live.sandbox.router")}</label>
        <textarea
          value={routerPrompt}
          onChange={(e) => setRouterPrompt(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs font-mono h-24 focus:border-cyan-500 focus:outline-none transition leading-relaxed"
          placeholder={t("live.sandbox.routerPh")}
        />
      </div>

      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-mono font-bold uppercase text-slate-500">{t("live.sandbox.safety")}</label>
        <textarea
          value={safetyRules}
          onChange={(e) => setSafetyRules(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs font-mono h-24 focus:border-cyan-500 focus:outline-none transition leading-relaxed"
          placeholder={t("live.sandbox.safetyPh")}
        />
      </div>

      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-mono font-bold uppercase text-slate-500">{t("live.sandbox.schema")}</label>
        <textarea
          value={executionSchema}
          onChange={(e) => setExecutionSchema(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs font-mono h-20 focus:border-cyan-500 focus:outline-none transition leading-relaxed"
          placeholder={t("live.sandbox.schemaPh")}
        />
      </div>

      <div className="pt-2 text-[10px] text-slate-500 leading-normal border-t border-slate-900">
        💡 {t("live.sandbox.note")}
      </div>
    </div>
  );
}