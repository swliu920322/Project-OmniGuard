"use client";

import React from "react";
import { LogEntry } from "../lib/kinematic";

interface AuditLogProps {
  logs: LogEntry[];
  showEdgeProgress?: boolean;
  onToggleEdgeProgress?: () => void;
}

export default function AuditLog({ logs, showEdgeProgress, onToggleEdgeProgress }: AuditLogProps) {
  const filtered = showEdgeProgress
    ? logs
    : logs.filter((l) => !l.message.startsWith("[EDGE] ⚡"));

  return (
    <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-5 md:p-6 shadow-lg backdrop-blur-sm flex flex-col h-64 md:h-80">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">
          Audit Log
        </h2>
        {onToggleEdgeProgress && (
          <button
            onClick={onToggleEdgeProgress}
            className={`text-[10px] uppercase tracking-wider font-mono font-bold px-2.5 py-1 rounded-lg border transition-colors ${
              showEdgeProgress
                ? "bg-cyan-950/60 border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/60"
                : "bg-slate-900/60 border-slate-700/50 text-slate-500 hover:bg-slate-800/60 hover:text-slate-400"
            }`}
          >
            ⚡ edge checks
          </button>
        )}
      </div>
      <div className="flex-1 bg-slate-950 border border-slate-900 rounded-xl p-4 overflow-y-auto font-mono text-xs space-y-2">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic text-center py-8">Awaiting simulation events...</div>
        ) : (
          filtered.map((log, idx) => (
            <div key={idx} className="text-slate-300 leading-relaxed break-words">
              <span className="text-slate-600 mr-2">[{log.timestamp}]</span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
