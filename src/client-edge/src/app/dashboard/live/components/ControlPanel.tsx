// Control panel for the live page: tenant, X coordinate, speed and distance settings,
// scenario presets, and the start / single-step buttons.
"use client";

import { useI18n } from "@/components/I18nProvider";
import ScenarioPresets from "./ScenarioPresets";
import type { ExitPath, ScenarioId } from "../config/scenarios";
import type { SuiteState } from "../hooks/useFleetSimulation";

export interface ControlPanelProps {
  tenantId: string;
  currentX: number;
  targetSpeed: number;
  distance: number;
  jitterEnabled: boolean;
  autopilot: boolean;
  loading: boolean;
  updateTenant: (id: string) => void;
  updateCurrentX: (value: number) => void;
  updateTargetSpeed: (value: number) => void;
  updateDistance: (value: number) => void;
  toggleJitter: () => void;
  applyScenario: (id: ScenarioId) => void;
  runSuite: () => Promise<void>;
  activeScenario: ScenarioId | null;
  observedExit: ExitPath | null;
  suite: SuiteState;
  reset: () => void;
  toggleAutopilot: () => void;
  triggerSimulation: () => Promise<void>;
}

export default function ControlPanel({
  tenantId,
  currentX,
  targetSpeed,
  distance,
  jitterEnabled,
  autopilot,
  loading,
  updateTenant,
  updateCurrentX,
  updateTargetSpeed,
  updateDistance,
  toggleJitter,
  applyScenario,
  runSuite,
  activeScenario,
  observedExit,
  suite,
  reset,
  toggleAutopilot,
  triggerSimulation,
}: ControlPanelProps) {
  const { t } = useI18n();
  const tenantKey = tenantId === "Tenant-Beta" ? "beta" : "alpha";
  const busy = loading || autopilot;

  return (
    <section className="bg-slate-950 px-6 py-6 border-b border-slate-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-900/25 border border-slate-900 p-5 rounded-2xl backdrop-blur-sm shadow-inner">
        {/* Dropdown Selection */}
        <div className="flex flex-col space-y-2">
          <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">{t("live.control.tenant")}</label>
          <select
            value={tenantId}
            onChange={(e) => updateTenant(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none transition"
          >
            <option value="Tenant-Alpha">{t("live.tenant.alpha.name")}</option>
            <option value="Tenant-Beta">{t("live.tenant.beta.name")}</option>
          </select>
          <p className="text-slate-500 text-xs italic">{t(`live.tenant.${tenantKey}.desc`)}</p>
        </div>

        {/* Current X Position (Readout/Modify) */}
        <div className="flex flex-col space-y-2">
          <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">{t("live.control.currentX")}</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={Number(currentX.toFixed(2))}
              onChange={(e) => updateCurrentX(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm w-full focus:border-cyan-500 focus:outline-none transition"
            />
            <span className="text-xs text-slate-500 font-mono">{t("live.control.meters")}</span>
          </div>
          <p className="text-slate-500 text-xs italic">{t("live.control.currentXHelp")}</p>
        </div>

        {/* Slider for Target Speed Limit */}
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">{t("live.control.maxSpeed")}</label>
            <span className="text-sm font-mono font-bold text-cyan-400">{targetSpeed} cm/s</span>
          </div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="10"
              max="100"
              value={targetSpeed}
              onChange={(e) => updateTargetSpeed(Number(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>10cm/s ({t("live.control.slow")})</span>
            <span>100cm/s ({t("live.control.fast")})</span>
          </div>
        </div>

        {/* Slider for Obstacle Distance */}
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">{t("live.control.obstacle")}</label>
            <span className="text-sm font-mono font-bold text-cyan-400">{distance.toFixed(0)} cm</span>
          </div>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="0"
              max="100"
              value={distance}
              onChange={(e) => updateDistance(Number(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>0cm ({t("live.control.imminent")})</span>
            <span>100cm ({t("live.control.far")})</span>
          </div>
          <p className="text-slate-500 text-xs italic">{t("live.control.obstacleHelp")}</p>
        </div>
      </div>

      <ScenarioPresets
        activeScenario={activeScenario}
        observedExit={observedExit}
        suite={suite}
        jitterEnabled={jitterEnabled}
        busy={busy}
        applyScenario={applyScenario}
        runSuite={runSuite}
        toggleJitter={toggleJitter}
        reset={reset}
      />

      {/* Action Button Bar */}
      <div className="max-w-7xl mx-auto mt-5 flex items-center justify-end space-x-4">
        <p className="text-[11px] text-slate-500 mr-auto">{t("live.control.resetNote")}</p>
        <button
          onClick={toggleAutopilot}
          disabled={suite.running}
          className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase transition shadow-lg ${
            autopilot
              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse border border-red-400/50 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              : "bg-slate-900 border border-slate-800 text-cyan-400 hover:border-cyan-500/30 hover:text-cyan-300"
          }`}
        >
          {autopilot ? `🛑 ${t("live.control.stop")}` : `🚀 ${t("live.control.start")}`}
        </button>

        <button
          onClick={triggerSimulation}
          disabled={loading || autopilot || suite.running}
          className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase transition shadow-lg ${
            loading || autopilot
              ? "bg-slate-900 border border-slate-800 text-slate-650 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.98] border border-cyan-400/20"
          }`}
        >
          {loading ? t("live.control.processing") : t("live.control.manual")}
        </button>
      </div>
    </section>
  );
}