"use client";

// Timing and runtime of the last backend response. Only values the backend really reports are
// shown: Cosmos rows appear only when device-twin storage was used, and nothing here claims
// anything about network isolation.

import React from "react";
import { useI18n } from "@/components/I18nProvider";
import type { SimulateResponse } from "../lib/simulation";

interface InfraTelemetryPanelProps {
  metrics: SimulateResponse["cloud_metrics"] | undefined;
  totalMs?: number;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-900 pb-0.5 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-cyan-400 font-bold">{value}</span>
    </div>
  );
}

export default function InfraTelemetryPanel({ metrics, totalMs }: InfraTelemetryPanelProps) {
  const { t } = useI18n();
  const ms = (value: number | null | undefined) => (value === null || value === undefined ? "--" : `${value} ms`);
  const cosmosUsed = metrics?.cosmos_write_latency_ms !== null && metrics?.cosmos_write_latency_ms !== undefined;

  return (
    <div className="mb-4 border border-slate-900 bg-slate-950 rounded-xl p-4">
      <h3 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold mb-3">{t("live.timing.title")}</h3>
      {!metrics ? (
        <div className="text-xs font-mono text-slate-600 italic text-center py-3">{t("live.timing.none")}</div>
      ) : (
        <div className="space-y-1.5 text-[11px] font-mono">
          <Row label={t("live.timing.router")} value={ms(metrics.agent_1_latency_ms)} />
          <Row label={t("live.timing.safety")} value={ms(metrics.agent_2_latency_ms)} />
          <Row label={t("live.timing.compiler")} value={ms(metrics.agent_3_latency_ms)} />
          {totalMs !== undefined && <Row label={t("live.timing.total")} value={ms(totalMs)} />}
          <Row
            label={t("live.timing.runtime")}
            value={metrics.execution_environment === "azure-functions" ? t("live.timing.runtimeAzure") : t("live.timing.runtimeLocal")}
          />
          {cosmosUsed ? (
            <>
              <Row label={t("live.timing.cosmosRu")} value={metrics.cosmos_db_ru_charge ? `${metrics.cosmos_db_ru_charge} RU` : "--"} />
              <Row label={t("live.timing.cosmosRead")} value={ms(metrics.cosmos_read_latency_ms)} />
              <Row label={t("live.timing.cosmosWrite")} value={ms(metrics.cosmos_write_latency_ms)} />
            </>
          ) : (
            <Row label={t("live.timing.persistence")} value={t("live.timing.persistenceOff")} />
          )}
        </div>
      )}
    </div>
  );
}
