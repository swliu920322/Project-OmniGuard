"use client";

import React from "react";
import { TrackId, Scenario } from "../config/scenarios";
import { computeCloudLatencyMs, LLMBreakdownParams } from "../../shared/physics";
import AGVTrack from "./AGVTrack";
import AgentPipelineOverlay from "./AgentPipelineOverlay";

interface FleetTrackViewProps {
  tracks: Record<TrackId, { status: "idle" | "running" | "crashed" | "safe_stop"; positionM: number }>;
  scenario: Scenario;
  tokenLLM: LLMBreakdownParams;
}

export default function FleetTrackView({ tracks, scenario, tokenLLM }: FleetTrackViewProps) {
  const ids: TrackId[] = ["agv01", "agv02", "agv03"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {ids.map((id) => {
        const cfg = scenario.tracks[id];
        const liveCloudMs = cfg.cloudLatencyMs === "computed"
          ? computeCloudLatencyMs(tokenLLM)
          : cfg.cloudLatencyMs;
        return (
          <AGVTrack
            key={id}
            label={cfg.label}
            positionM={tracks[id].positionM}
            totalDistanceM={scenario.shared.totalDistanceM}
            clearanceM={scenario.shared.clearanceM}
            status={tracks[id].status}
            trackId={id}
            config={cfg}
            liveCloudMs={liveCloudMs}
          />
        );
      })}
      <AgentPipelineOverlay tracks={tracks} scenario={scenario} />
    </div>
  );
}
