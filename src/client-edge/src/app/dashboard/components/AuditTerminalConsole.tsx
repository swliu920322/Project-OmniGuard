"use client";

import React from "react";

interface AuditTerminalConsoleProps {
  response: any | null;
}

export default function AuditTerminalConsole({ response }: AuditTerminalConsoleProps) {
  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 h-64 font-mono text-xs text-slate-400 overflow-auto flex flex-col shadow-inner select-text">
      <div className="flex items-center space-x-1.5 border-b border-slate-900 pb-2 mb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60"></div>
        <span className="text-[10px] text-slate-600 pl-2">omniguard_audit_console.log</span>
      </div>
      <div className="flex-1 font-mono leading-normal">
        {response ? (
          <pre className="text-cyan-500/90 leading-relaxed">
            {JSON.stringify(response, null, 2)}
          </pre>
        ) : (
          <div className="text-slate-600 italic py-10 text-center">
            // Initialize simulation to output raw JSON telemetry payload here.
          </div>
        )}
      </div>
    </div>
  );
}
