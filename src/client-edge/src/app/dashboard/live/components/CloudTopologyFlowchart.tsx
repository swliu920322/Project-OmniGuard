"use client";

// Static diagram of the reference architecture. It describes the Azure deployment the thesis
// used; that environment is not deployed now, which the note at the top says.

import React from "react";
import { useI18n } from "@/components/I18nProvider";

interface CloudTopologyFlowchartProps {
  isAlert: boolean;
}

export default function CloudTopologyFlowchart({ isAlert }: CloudTopologyFlowchartProps) {
  const { t } = useI18n();
  return (
    <div className="border border-slate-900 bg-slate-950 rounded-xl p-4 min-h-[18rem] shadow-inner shadow-black/80">
      <p className="text-[10px] text-amber-400/80 italic mb-3 leading-snug">{t("live.topology.note")}</p>
      <div className="flex flex-col space-y-3.5 font-mono text-xs">
        {/* Node 1: Device Simulator */}
        <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-cyan-400 font-bold">🖥️ {t("live.topology.device")}</div>
            <div className="text-[10px] text-slate-500 font-sans">device_mock.py</div>
          </div>
          <span className="text-[9px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
            {t("live.topology.local")}
          </span>
        </div>

        <div className="flex justify-center text-slate-700 font-bold text-[10px]">⬇️ {t("live.topology.stream")}</div>

        {/* Node 2: Azure IoT Hub */}
        <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex flex-col space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-teal-400 font-bold">☁️ {t("live.topology.hub")}</span>
            <span className="text-[8px] tracking-wider uppercase font-mono px-1.5 py-0.5 rounded border border-slate-800 bg-slate-950 text-slate-500">
              nested-infra.bicep
            </span>
          </div>
          <div className="text-[9px] text-slate-500 font-sans">{t("live.topology.hubAuth")}</div>
        </div>

        <div className="flex justify-center text-slate-700 font-bold text-[10px]">⬇️ {t("live.topology.trigger")}</div>

        {/* Node 3: Azure Functions (compute) */}
        <div className={`border p-2.5 rounded-xl flex flex-col space-y-1 transition-all duration-300 ${
          isAlert ? "border-red-500/40 bg-red-950/10 text-slate-100" : "border-slate-850 bg-slate-900/30 text-slate-300"
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-indigo-400 font-bold">⚡ {t("live.topology.functions")}</span>
            <span className="text-[8px] tracking-wider uppercase font-mono px-1.5 py-0.5 rounded border border-slate-800 bg-slate-950 text-slate-500">
              compute-module.bicep
            </span>
          </div>
          <div className="text-[9px] text-slate-500 font-sans">brain.py / iot_telemetry_processor</div>
        </div>

        <div className="flex justify-center text-slate-700 font-bold text-[10px]">🔁 {t("live.topology.backbone")}</div>

        {/* Node 4: storage and LLM */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex flex-col space-y-1">
            <span className="text-emerald-400 font-bold">🗄️ {t("live.topology.cosmos")}</span>
            <span className="text-[8px] text-slate-500">nested-infra.bicep</span>
            <span className="text-[9px] text-slate-400">{t("live.topology.cosmosDetail")}</span>
          </div>
          <div className="border border-slate-850 bg-slate-900/30 p-2.5 rounded-xl flex flex-col space-y-1">
            <span className="text-pink-400 font-bold">🤖 {t("live.topology.llm")}</span>
            <span className="text-[8px] text-slate-500">{t("live.topology.llmTag")}</span>
            <span className="text-[9px] text-slate-400">{t("live.topology.llmDetail")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
