// Prompt override controls for the Fleet Dashboard.
// Extracted from the inline renderSandboxTab function in page.tsx.

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
  return (
    <div className="border border-slate-900 bg-slate-950/70 backdrop-blur-sm rounded-xl p-5 space-y-4 shadow-inner shadow-black/80">
      <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-cyan-400 flex items-center space-x-2">
        <span>🛠️ Orchestration Sandbox</span>
        <span className="text-[10px] text-slate-500 normal-case font-normal">(Override Agent Configs on the Fly)</span>
      </h3>

      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-mono font-bold uppercase text-slate-500">Agent 1: Router Prompt Override</label>
        <textarea
          value={routerPrompt}
          onChange={(e) => setRouterPrompt(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs font-mono h-24 focus:border-cyan-500 focus:outline-none transition leading-relaxed"
          placeholder="System prompt for classification router..."
        />
      </div>

      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-mono font-bold uppercase text-slate-500">Agent 2: Safety Rules Override</label>
        <textarea
          value={safetyRules}
          onChange={(e) => setSafetyRules(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs font-mono h-24 focus:border-cyan-500 focus:outline-none transition leading-relaxed"
          placeholder="Rules applied by safety firewall..."
        />
      </div>

      <div className="flex flex-col space-y-1.5">
        <label className="text-[10px] font-mono font-bold uppercase text-slate-500">Agent 3: Execution Schema Override</label>
        <textarea
          value={executionSchema}
          onChange={(e) => setExecutionSchema(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2.5 text-xs font-mono h-20 focus:border-cyan-500 focus:outline-none transition leading-relaxed"
          placeholder="Expected JSON motor schema output..."
        />
      </div>

      <div className="pt-2 text-[10px] text-slate-500 leading-normal border-t border-slate-900">
        💡 Edits made here will override the default tenant configuration database live on subsequent manual or autopilot evaluation steps.
      </div>
    </div>
  );
}