"use client";

import React from "react";

interface CloudTopologyFlowchartProps {
  isAlert: boolean;
}

export default function CloudTopologyFlowchart({ isAlert }: CloudTopologyFlowchartProps) {
  return (
    <div className="border border-slate-900 bg-slate-950 rounded-xl p-4 min-h-[18rem] shadow-inner shadow-black/80">
      <div className="flex flex-col space-y-3.5 font-mono text-xs">
        {/* Node 1: Device Simulator */}
        <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-cyan-400 font-bold">🖥️ Edge Device Simulator</div>
            <div className="text-[10px] text-slate-500 font-sans">device_mock.py</div>
          </div>
          <span className="text-[9px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
            Local Node
          </span>
        </div>

        {/* Connector Arrow */}
        <div className="flex justify-center text-slate-700 font-bold text-[10px]">⬇️ MQTT Stream (1Hz)</div>

        {/* Node 2: Azure IoT Hub */}
        <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex flex-col space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-teal-400 font-bold">☁️ Azure IoT Hub (F1 Free)</span>
            <span className="text-[8px] tracking-wider uppercase font-mono px-1.5 py-0.5 rounded border border-slate-800 bg-slate-950 text-slate-500">
              nested-infra.bicep
            </span>
          </div>
          <div className="text-[9px] text-slate-500 font-sans">Hostname & SAS Token Authentication</div>
        </div>

        {/* Connector Arrow */}
        <div className="flex justify-center text-slate-700 font-bold text-[10px]">⬇️ Event Hub Trigger</div>

        {/* Node 3: Azure Functions (Compute Engine) */}
        <div className={`border p-2.5 rounded-xl flex flex-col space-y-1 transition-all duration-300 ${
          isAlert ? "border-red-500/40 bg-red-950/10 text-slate-100" : "border-slate-850 bg-slate-900/30 text-slate-300"
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-indigo-400 font-bold">⚡ Azure Functions (Serverless)</span>
            <span className="text-[8px] tracking-wider uppercase font-mono px-1.5 py-0.5 rounded border border-slate-800 bg-slate-950 text-slate-500">
              compute-module.bicep
            </span>
          </div>
          <div className="text-[9px] text-slate-500 font-sans">brain.py / iot_telemetry_processor</div>
        </div>

        {/* Connector Arrow */}
        <div className="flex justify-center text-slate-700 font-bold text-[10px]">🔁 Secure VNet Backbone</div>

        {/* Node 4: Cloud databases & LLM */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex flex-col space-y-1">
            <span className="text-emerald-400 font-bold">🗄️ Cosmos DB</span>
            <span className="text-[8px] text-slate-500">nested-infra.bicep</span>
            <span className="text-[9px] text-slate-400">DeviceTwins /tenant_id</span>
          </div>
          <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex flex-col space-y-1">
            <span className="text-pink-400 font-bold">🤖 Azure OpenAI</span>
            <span className="text-[8px] text-slate-500">Shared Resource</span>
            <span className="text-[9px] text-slate-400">gpt-5.4-mini</span>
          </div>
        </div>
      </div>
    </div>
  );
}
