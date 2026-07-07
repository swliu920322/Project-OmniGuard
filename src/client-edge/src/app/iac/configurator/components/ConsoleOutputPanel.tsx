import React from 'react';
import { Terminal } from 'lucide-react';

interface ConsoleOutputPanelProps {
  assemblerConsole: string | null;
}

export const ConsoleOutputPanel: React.FC<ConsoleOutputPanelProps> = ({
  assemblerConsole
}) => {
  if (!assemblerConsole) return null;

  return (
    <div className="max-w-8xl mx-auto mt-8 bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-2xl relative font-mono text-xs">
      <h3 className="text-slate-400 mb-3 border-b border-slate-900/60 pb-2 flex items-center gap-2">
        <Terminal size={13} className="text-cyan-400 animate-pulse" />
        <span>COMPILER_CONSOLE_OUTPUT (编译与自愈防御日志)</span>
      </h3>
      <div className="bg-[#030712] p-4 rounded-xl border border-slate-900/60 text-slate-300 select-text max-h-80 overflow-y-auto font-mono leading-relaxed whitespace-pre font-bold">
        {assemblerConsole}
      </div>
    </div>
  );
};
