"use client";

import React from "react";

interface PipelineStep {
  agent: string;
  decision: string;
  status?: "PASS" | "BLOCKED" | "SHORT_CIRCUIT" | "COMPILED";
}

interface AgentOrchestratorFlowProps {
  response: { pipeline_trace: PipelineStep[] } | null;
  triggerDist: string;
}

export default function AgentOrchestratorFlow({ response, triggerDist }: AgentOrchestratorFlowProps) {
  
  function getStepByAgent(agentName: string): PipelineStep | null {
    if (!response) return null;
    return response.pipeline_trace.find(step => step.agent === agentName) || null;
  }

  function renderAgentNode(title: string, desc: string, step: PipelineStep | null, primaryColor: "purple" | "red" | "cyan") {
    let statusClass = "bg-slate-900/30 border-slate-900 text-slate-500 opacity-60";
    let badgeClass = "bg-slate-950 text-slate-600 border-slate-800";
    let badgeText = "Awaiting";

    if (step) {
      if (step.status === "PASS" || step.status === "COMPILED" || (step.agent === "Router" && step.decision)) {
        statusClass = "border-emerald-500/40 bg-emerald-950/5 text-slate-100 shadow-[0_0_15px_rgba(16,185,129,0.05)]";
        badgeClass = "bg-emerald-950/80 border-emerald-500/30 text-emerald-400";
        badgeText = step.status || "PASS";
      } else if (step.status === "BLOCKED") {
        statusClass = "border-red-500/40 bg-red-950/5 text-slate-100 shadow-[0_0_15px_rgba(239,68,68,0.05)]";
        badgeClass = "bg-red-950/80 border-red-500/30 text-red-400 animate-pulse";
        badgeText = "BLOCKED";
      } else if (step.status === "SHORT_CIRCUIT" || step.decision === "SKIPPED") {
        statusClass = "border-slate-900 bg-slate-900/10 text-slate-500 opacity-30";
        badgeClass = "bg-slate-950 text-slate-600 border-slate-800";
        badgeText = "SKIPPED";
      }
    }

    const dotColors = {
      purple: "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]",
      red: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
      cyan: "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
    };

    return (
      <div className={`flex items-start space-x-4 border rounded-xl p-4 transition-all duration-300 ${statusClass}`}>
        {/* Step Indicator Dot */}
        <div className={`w-4 h-4 rounded-full mt-1.5 flex items-center justify-center z-10 ${dotColors[primaryColor]}`}>
          <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
        </div>

        {/* Content details */}
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold tracking-tight">{title}</h3>
            <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${badgeClass}`}>
              {badgeText}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-normal">{desc}</p>
          
          {step && step.decision && step.decision !== "SKIPPED" && (
            <div className="bg-slate-950 border border-slate-900 rounded-lg p-2.5 mt-2">
              <div className="text-[10px] uppercase font-mono text-slate-500 font-bold mb-1">Decision Output</div>
              <div className="text-xs font-mono font-bold text-cyan-400 break-all whitespace-pre-wrap">
                {step.decision}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Vertical connector line */}
      <div className="absolute top-6 bottom-6 left-6 w-[2px] bg-slate-800 pointer-events-none -z-10"></div>

      {/* Node 1: Intent Router */}
      {renderAgentNode(
        "1. Intent Router",
        "Classifies raw telemetry to determine the operational context.",
        getStepByAgent("Router"),
        "purple"
      )}

      {/* Node 2: Safety Firewall */}
      {renderAgentNode(
        "2. Safety Firewall",
        `Applies strict compliance policies. Target: ${triggerDist}.`,
        getStepByAgent("Safety"),
        "red"
      )}

      {/* Node 3: Action Compiler */}
      {renderAgentNode(
        "3. Action Compiler",
        "Translates safe intents into compliant physical motor instructions.",
        getStepByAgent("Action Compiler"),
        "cyan"
      )}
    </div>
  );
}
