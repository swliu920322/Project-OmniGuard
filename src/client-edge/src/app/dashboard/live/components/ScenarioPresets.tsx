"use client";

// Scenario presets: each button loads settings and a starting car state, and says which
// pipeline path the backend is expected to take. After a run the observed path is compared
// with the expectation. "Run all scenarios" does this for every preset in turn.

import { useI18n } from "@/components/I18nProvider";
import { ExitPath, getScenario, LIVE_SCENARIOS, ScenarioId } from "../config/scenarios";
import type { SuiteState } from "../hooks/useFleetSimulation";

export interface ScenarioPresetsProps {
  activeScenario: ScenarioId | null;
  observedExit: ExitPath | null;
  suite: SuiteState;
  jitterEnabled: boolean;
  busy: boolean; // a run is in progress: presets are locked
  applyScenario: (id: ScenarioId) => void;
  runSuite: () => Promise<void>;
  toggleJitter: () => void;
  reset: () => void;
}

const BUTTON = "text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition border disabled:opacity-40 disabled:cursor-not-allowed";

export default function ScenarioPresets({
  activeScenario,
  observedExit,
  suite,
  jitterEnabled,
  busy,
  applyScenario,
  runSuite,
  toggleJitter,
  reset,
}: ScenarioPresetsProps) {
  const { t } = useI18n();
  const locked = busy || suite.running;
  const active = activeScenario ? getScenario(activeScenario) : null;
  const passCount = suite.rows.filter((row) => row.ok).length;
  const exitLabel = (exit: ExitPath | null) => (exit ? t(`live.scenarios.exit.${exit}`) : t("live.scenarios.pending"));

  return (
    <div className="max-w-7xl mx-auto mt-5 p-4 bg-slate-900/10 border border-slate-900 rounded-xl space-y-4">
      <div className="flex items-center space-x-2">
        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span>
        <span className="text-xs uppercase tracking-wider font-mono text-slate-400 font-bold">{t("live.scenarios.title")}</span>
        <span className="text-[11px] text-slate-500 hidden md:inline">{t("live.scenarios.hint")}</span>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {LIVE_SCENARIOS.map((sc) => (
          <button
            key={sc.id}
            disabled={locked}
            onClick={() => applyScenario(sc.id)}
            className={`${BUTTON} ${
              activeScenario === sc.id
                ? "bg-purple-950/60 border-purple-400/60 text-purple-200"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:border-purple-500/40"
            }`}
          >
            {sc.icon} {t(`live.scenarios.names.${sc.id}`)}
          </button>
        ))}
        <button
          disabled={locked}
          onClick={toggleJitter}
          className={`${BUTTON} ${
            jitterEnabled
              ? "bg-red-950/50 border-red-500/40 text-red-300"
              : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
          }`}
        >
          📶 {jitterEnabled ? t("live.scenarios.jitterOn") : t("live.scenarios.jitterOff")}
        </button>
        <button
          disabled={locked}
          onClick={reset}
          className={`${BUTTON} bg-slate-900 border-slate-800 text-slate-500 hover:border-cyan-500/30 hover:text-cyan-400`}
        >
          🔄 {t("live.scenarios.reset")}
        </button>
        <button
          disabled={locked}
          onClick={runSuite}
          className={`${BUTTON} bg-cyan-950/40 border-cyan-500/30 text-cyan-300 hover:border-cyan-400/60`}
        >
          ▶ {suite.running ? t("live.scenarios.running") : t("live.scenarios.runAll")}
        </button>
      </div>

      {active && (
        <div className="text-xs font-mono bg-slate-950 border border-slate-900 rounded-lg p-3 space-y-1.5">
          <div className="text-slate-400">
            <span className="text-slate-500">{t("live.scenarios.active")}: </span>
            {active.icon} {t(`live.scenarios.names.${active.id}`)}
          </div>
          <div className="text-slate-400">
            <span className="text-slate-500">{t("live.scenarios.expected")}: </span>
            {exitLabel(active.expect)}
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-slate-500">{t("live.scenarios.observed")}: </span>
            <span>{exitLabel(observedExit)}</span>
            {observedExit && (
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                  observedExit === active.expect
                    ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-400"
                    : "bg-red-950/70 border-red-500/40 text-red-400"
                }`}
              >
                {observedExit === active.expect ? t("live.scenarios.match") : t("live.scenarios.mismatch")}
              </span>
            )}
          </div>
          {active.modelDependent && <div className="text-amber-400/80 italic">{t("live.scenarios.modelDependent")}</div>}
        </div>
      )}

      {suite.rows.length > 0 && (
        <div className="bg-slate-950 border border-slate-900 rounded-lg p-3 overflow-x-auto">
          <div className="flex justify-between items-center mb-2 text-xs font-mono">
            <span className="text-slate-400 font-bold uppercase">{t("live.scenarios.suite.title")}</span>
            <span className="text-cyan-400">
              {t("live.scenarios.suite.summary", { pass: passCount, total: suite.rows.length })}
            </span>
          </div>
          <table className="w-full text-[11px] font-mono text-left">
            <thead className="text-slate-500 uppercase">
              <tr>
                <th className="py-1 pr-3">{t("live.scenarios.suite.scenario")}</th>
                <th className="py-1 pr-3">{t("live.scenarios.expected")}</th>
                <th className="py-1 pr-3">{t("live.scenarios.observed")}</th>
                <th className="py-1 pr-3">{t("live.scenarios.suite.calls")}</th>
                <th className="py-1 pr-3">{t("live.scenarios.suite.latency")}</th>
                <th className="py-1">{t("live.scenarios.suite.result")}</th>
              </tr>
            </thead>
            <tbody>
              {suite.rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-900 text-slate-300">
                  <td className="py-1 pr-3">{t(`live.scenarios.names.${row.id}`)}</td>
                  <td className="py-1 pr-3">{exitLabel(row.expected)}</td>
                  <td className="py-1 pr-3">{row.error ?? exitLabel(row.observed)}</td>
                  <td className="py-1 pr-3">{row.calls ?? "--"}</td>
                  <td className="py-1 pr-3">{row.latencyMs !== null ? `${row.latencyMs} ms` : "--"}</td>
                  <td className={`py-1 font-bold ${row.ok ? "text-emerald-400" : "text-red-400"}`}>
                    {row.ok ? t("live.scenarios.match") : t("live.scenarios.mismatch")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[10px] text-slate-600">{t("live.scenarios.suite.wait")}</div>
        </div>
      )}
    </div>
  );
}
