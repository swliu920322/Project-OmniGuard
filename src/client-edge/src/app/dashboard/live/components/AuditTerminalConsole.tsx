"use client";

import React, { useState } from "react";

interface AuditTerminalConsoleProps {
  response: any | null;
  logs: string[];
}

export default function AuditTerminalConsole({ response, logs }: AuditTerminalConsoleProps) {
  const [activeTab, setActiveTab] = useState<"json" | "physics">("physics");
  
  return (
    <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 h-64 font-mono text-xs text-slate-400 overflow-hidden flex flex-col shadow-inner select-text">
      <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
        <div className="flex items-center space-x-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60"></div>
          <span className="text-[10px] text-slate-600 pl-2">omniguard_console.log</span>
        </div>
        
        {/* Toggle tabs */}
        <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 text-[9px] uppercase font-mono">
          <button 
            onClick={() => setActiveTab("physics")}
            className={`px-2 py-0.5 rounded transition ${activeTab === "physics" ? "bg-slate-950 text-cyan-400 font-bold" : "text-slate-500 hover:text-slate-400"}`}
          >
            Physics Logs ({logs.length})
          </button>
          <button 
            onClick={() => setActiveTab("json")}
            className={`px-2 py-0.5 rounded transition ${activeTab === "json" ? "bg-slate-950 text-cyan-400 font-bold" : "text-slate-500 hover:text-slate-400"}`}
          >
            Raw API
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto font-mono leading-relaxed">
        {activeTab === "json" ? (
          response ? (
            <pre className="text-cyan-500/90 whitespace-pre-wrap">
              {JSON.stringify(response, null, 2)}
            </pre>
          ) : (
            <div className="text-slate-600 italic py-10 text-center">
              // Initialize simulation to output raw JSON telemetry payload.
            </div>
          )
        ) : (
          logs.length > 0 ? (
            <div className="space-y-1.5 text-slate-300">
              {logs.map((log, idx) => {
                let color = "text-slate-400";
                if (log.includes("[CRITICAL IMPACT]")) color = "text-red-500 font-bold animate-pulse";
                else if (log.includes("[WARNING]")) color = "text-amber-500 font-semibold";
                else if (log.includes("[SAFE HALT]")) color = "text-emerald-400 font-bold";
                else if (log.includes("[EVENT]")) color = "text-purple-400 font-medium";
                
                return (
                  <div key={idx} className={`border-b border-slate-900/40 pb-1 font-mono text-[11px] ${color}`}>
                    <span className="text-slate-600 mr-1.5">[{new Date().toLocaleTimeString()}]</span>
                    {log}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-600 italic py-10 text-center">
              // Physics environment events and latency metrics will stream here.
            </div>
          )
        )}
      </div>
    </div>
  );
}
