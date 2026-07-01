"use client";

import React from "react";
import { LogEntry } from "../lib/kinematic";

interface AuditLogProps {
  logs: LogEntry[];
}

export default function AuditLog({ logs }: AuditLogProps) {
  return (
    <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-5 md:p-6 shadow-lg backdrop-blur-sm flex flex-col h-64 md:h-80">
      <h2 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold mb-4">
        Audit Log
      </h2>
      <div className="flex-1 bg-slate-950 border border-slate-900 rounded-xl p-4 overflow-y-auto font-mono text-xs space-y-2">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic text-center py-8">Awaiting simulation events...</div>
        ) : (
          logs.map((log, idx) => (
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
