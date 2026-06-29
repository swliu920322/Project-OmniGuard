"use client";

import React from "react";

interface PhysicalTwinVisualizerProps {
  distance: number;
  currentX: number;
  robotPosition: number;
  isAlert: boolean;
}

export default function PhysicalTwinVisualizer({
  distance,
  currentX,
  robotPosition,
  isAlert
}: PhysicalTwinVisualizerProps) {
  return (
    <div className="h-72 border border-slate-900 bg-slate-950 rounded-xl relative overflow-hidden flex flex-col justify-between shadow-inner shadow-black/80">
      <div className="h-full w-full flex items-center relative p-4">
        {/* Distance Grid Markings */}
        <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-10 border-x border-slate-900/30 pointer-events-none">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border-r border-slate-900/15 h-full"></div>
          ))}
        </div>

        {/* Laser sensor line */}
        <div 
          className="absolute h-[1px] border-t border-dashed pointer-events-none transition-all duration-305"
          style={{
            left: `${robotPosition}%`,
            right: `8%`,
            borderColor: isAlert ? "#ef4444" : "#10b981",
            borderWidth: isAlert ? "2px" : "1px"
          }}
        >
          <div className={`absolute top-0 right-0 w-2 h-2 -mt-1 rounded-full animate-ping ${
            isAlert ? "bg-red-500" : "bg-emerald-500"
          }`}></div>
        </div>

        {/* Robot Simulator Icon */}
        <div 
          className="absolute w-12 h-12 -ml-6 rounded-full border bg-slate-900 flex items-center justify-center transition-all duration-305 shadow-md shadow-black/80 z-10"
          style={{ 
            left: `${robotPosition}%`,
            borderColor: isAlert ? "#ef4444" : "#06b6d4",
            boxShadow: isAlert ? "0 0 20px rgba(239,68,68,0.2)" : "0 0 20px rgba(6,182,212,0.2)"
          }}
        >
          <svg className={`w-6 h-6 transition-transform ${isAlert ? "text-red-400 rotate-12" : "text-cyan-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>

        {/* Obstacle Wall */}
        <div className="absolute right-0 top-0 bottom-0 w-[8%] bg-gradient-to-l from-slate-900 to-slate-950 border-l border-slate-800 flex items-center justify-center">
          <div className={`w-1.5 h-[80%] rounded-full ${
            isAlert ? "bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]" : "bg-slate-800"
          }`}></div>
        </div>

        {/* Warning Overlay shield */}
        {isAlert && (
          <div className="absolute inset-0 bg-red-950/10 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-none">
            <div className="bg-red-950/80 border border-red-500/30 rounded-xl px-4 py-2 text-center shadow-lg text-red-400 text-xs font-bold uppercase tracking-wider animate-bounce flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Emergency Halt (C2D)</span>
            </div>
          </div>
        )}
      </div>

      {/* Readouts below grid */}
      <div className="bg-slate-900/30 border-t border-slate-900 px-4 py-3 flex justify-between text-xs font-mono text-slate-400">
        <div>X Position: <span className="text-cyan-400">{currentX}m</span></div>
        <div>Sensor Gap: <span className={isAlert ? "text-red-400 font-bold" : "text-emerald-400"}>{distance}cm</span></div>
      </div>
    </div>
  );
}
