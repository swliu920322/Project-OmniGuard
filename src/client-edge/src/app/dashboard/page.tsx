"use client";

import { useEffect, useState } from "react";
import { useFleetSimulation2 } from "./hooks/useFleetSimulation2";
import FleetHeader from "./components/FleetHeader";
import FleetControlPanel from "./components/FleetControlPanel";
import FleetTrackView from "./components/FleetTrackView";

export default function FleetDashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const fleet = useFleetSimulation2();

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-cyan-400">Loading Fleet Control Plane...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <FleetHeader fleetStatus={fleet.fleetStatus} />

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* Control panel */}
        <FleetControlPanel
          activeScenario={fleet.activeScenario}
          onSelectScenario={fleet.selectScenario}
          onStart={fleet.start}
          onPause={fleet.pause}
          onResume={fleet.resume}
          onReset={fleet.reset}
          globalSpeedMps={fleet.globalSpeedMps}
          globalClearanceM={fleet.globalClearanceM}
          onUpdateSpeed={fleet.updateGlobalSpeed}
          onUpdateClearance={fleet.updateGlobalClearance}
          tokenLLM={fleet.tokenLLM}
          onUpdateTokenParam={fleet.updateTokenParam}
          simPhase={fleet.simPhase}
          fleetStatus={fleet.fleetStatus}
        />

        {/* Fleet track view */}
        <FleetTrackView tracks={fleet.tracks} scenario={fleet.activeScenario} tokenLLM={fleet.tokenLLM} />
      </main>
    </div>
  );
}
