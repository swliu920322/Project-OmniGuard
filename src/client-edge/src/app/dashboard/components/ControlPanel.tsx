// Control panel for the Fleet Dashboard: tenant config, distance/speed sliders, hazard injection, and action buttons.
// Extracted from page.tsx.

export interface ControlPanelProps {
  tenantId: string;
  tenantScenarioDesc: string;
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
  injectWorkerHazard: () => void;
  injectCargoHazard: () => void;
  injectOverheatingHazard: () => void;
  reset: () => void;
  toggleAutopilot: () => void;
  triggerSimulation: () => Promise<void>;
}

export default function ControlPanel({
  tenantId,
  tenantScenarioDesc,
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
  injectWorkerHazard,
  injectCargoHazard,
  injectOverheatingHazard,
  reset,
  toggleAutopilot,
  triggerSimulation,
}: ControlPanelProps) {
  return (
    <section className="bg-slate-950 px-6 py-6 border-b border-slate-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-900/25 border border-slate-900 p-5 rounded-2xl backdrop-blur-sm shadow-inner">
        {/* Dropdown Selection */}
        <div className="flex flex-col space-y-2">
          <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">Active Tenant</label>
          <select
            value={tenantId}
            onChange={(e) => updateTenant(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none transition"
          >
            <option value="Tenant-Alpha">Tenant-Alpha (Data Center)</option>
            <option value="Tenant-Beta">Tenant-Beta (Hospital Delivery)</option>
          </select>
          <p className="text-slate-500 text-xs italic">{tenantScenarioDesc}</p>
        </div>

        {/* Current X Position (Readout/Modify) */}
        <div className="flex flex-col space-y-2">
          <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">Current X Coordinates</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={currentX}
              onChange={(e) => updateCurrentX(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg px-3 py-2 text-sm w-full focus:border-cyan-500 focus:outline-none transition"
            />
            <span className="text-xs text-slate-500 font-mono">meters</span>
          </div>
          <p className="text-slate-500 text-xs italic">Represents current motor encoder localization telemetry.</p>
        </div>

        {/* Slider for Target Speed Limit */}
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">Max Speed Cap</label>
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
            <span>10cm/s (Slow)</span>
            <span>100cm/s (Fast)</span>
          </div>
        </div>

        {/* Slider for Obstacle Distance */}
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">Obstacle Distance</label>
            <span className="text-sm font-mono font-bold text-cyan-400">{distance} cm</span>
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
            <span>0cm (Imminent)</span>
            <span>100cm (Far)</span>
          </div>
        </div>
      </div>

      {/* Hazard Event Injection Panel (Blueprint 005 Section 1.1) */}
      <div className="max-w-7xl mx-auto mt-5 p-4 bg-slate-900/10 border border-slate-900 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span>
          <span className="text-xs uppercase tracking-wider font-mono text-slate-400 font-bold">Physical Hazard Event Injector:</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={injectWorkerHazard}
            className="bg-purple-950/40 border border-purple-500/20 hover:border-purple-500/50 text-purple-300 text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition"
          >
            👷‍♂️ Worker Appears (Type 1)
          </button>
          <button
            onClick={injectCargoHazard}
            className="bg-indigo-950/40 border border-indigo-500/20 hover:border-indigo-500/50 text-indigo-300 text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition"
          >
            📦 Fallen Cargo (Type 2)
          </button>
          <button
            onClick={injectOverheatingHazard}
            className="bg-amber-950/40 border border-amber-500/20 hover:border-amber-500/50 text-amber-300 text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition"
          >
            🔥 Overheating (Type 3)
          </button>
          <button
            onClick={toggleJitter}
            className={`text-xs px-3.5 py-2 rounded-lg font-mono font-semibold transition border ${
              jitterEnabled
                ? "bg-red-950/50 border-red-500/40 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
                : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
            }`}
          >
            📶 {jitterEnabled ? "Network Jitter: ON" : "Network Jitter: OFF"} (Type 4)
          </button>
          <button
            onClick={reset}
            className="bg-slate-900 border border-slate-800 hover:border-cyan-500/30 hover:text-cyan-400 text-slate-500 text-xs px-3.5 py-2 rounded-lg font-mono transition"
          >
            🔄 Reset Twins
          </button>
        </div>
      </div>

      {/* Action Button Bar */}
      <div className="max-w-7xl mx-auto mt-5 flex justify-end space-x-4">
        <button
          onClick={toggleAutopilot}
          className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase transition shadow-lg ${
            autopilot
              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse border border-red-400/50 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              : "bg-slate-900 border border-slate-800 text-cyan-400 hover:border-cyan-500/30 hover:text-cyan-300"
          }`}
        >
          {autopilot ? "🛑 Stop Autopilot" : "🚀 Start Autopilot"}
        </button>

        <button
          onClick={triggerSimulation}
          disabled={loading || autopilot}
          className={`px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide uppercase transition shadow-lg ${
            loading || autopilot
              ? "bg-slate-900 border border-slate-800 text-slate-650 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.98] border border-cyan-400/20"
          }`}
        >
          {loading ? "Processing..." : "Manual Single-Step"}
        </button>
      </div>
    </section>
  );
}