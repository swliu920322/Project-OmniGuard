"use client";

import React from "react";

interface PhysicalTwinVisualizerProps {
  distance: number;
  currentX: number;
  robotPosition: number;
  isAlert: boolean;
  hp: number;
  battery: number;
  velocity: number;
  temperature: number;
  latencyMs: number;
}

export default function PhysicalTwinVisualizer({
  distance,
  currentX,
  robotPosition,
  isAlert,
  hp,
  battery,
  velocity,
  temperature,
  latencyMs
}: PhysicalTwinVisualizerProps) {
  // Braking distance calculation: V * latency_s * 100 (in cm)
  const brakingDistance = velocity * (latencyMs / 1000) * 100;
  const collisionRisk = brakingDistance > distance && distance > 0;
  const isOverheated = temperature > 60;
  
  return (
    <div className="border border-slate-900 bg-slate-950 rounded-xl relative overflow-hidden flex flex-col justify-between shadow-inner shadow-black/80">
      
      {/* Simulation Track */}
      <div className="h-48 w-full flex items-center relative p-4 bg-slate-900/10 border-b border-slate-900/50">
        {/* Distance Grid Markings */}
        <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-10 border-x border-slate-900/30 pointer-events-none">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border-r border-slate-900/15 h-full"></div>
          ))}
        </div>

        {/* Laser sensor line */}
        <div 
          className="absolute h-[1px] border-t border-dashed pointer-events-none transition-all duration-300"
          style={{
            left: `${robotPosition}%`,
            right: `8%`,
            borderColor: isAlert ? "#ef4444" : collisionRisk ? "#f59e0b" : "#10b981",
            borderWidth: isAlert ? "2px" : collisionRisk ? "1.5px" : "1px"
          }}
        >
          <div className={`absolute top-0 right-0 w-2.5 h-2.5 -mt-1 rounded-full animate-ping ${
            isAlert ? "bg-red-500" : collisionRisk ? "bg-amber-500" : "bg-emerald-500"
          }`}></div>
        </div>

        {/* Robot Simulator Icon */}
        <div 
          className="absolute w-12 h-12 -ml-6 rounded-full border bg-slate-950 flex items-center justify-center transition-all duration-300 shadow-md shadow-black/80 z-10"
          style={{ 
            left: `${robotPosition}%`,
            borderColor: hp <= 0 ? "#64748b" : isAlert ? "#ef4444" : collisionRisk ? "#f59e0b" : "#06b6d4",
            boxShadow: hp <= 0 
              ? "0 0 10px rgba(100,116,139,0.1)" 
              : isAlert 
                ? "0 0 25px rgba(239,68,68,0.4)" 
                : collisionRisk
                  ? "0 0 20px rgba(245,158,11,0.3)"
                  : "0 0 20px rgba(6,182,212,0.3)"
          }}
        >
          <svg className={`w-6 h-6 transition-transform ${isAlert ? "text-red-400 rotate-12 animate-bounce" : hp <= 0 ? "text-slate-500" : collisionRisk ? "text-amber-400" : "text-cyan-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>

        {/* Obstacle Wall */}
        <div className="absolute right-0 top-0 bottom-0 w-[8%] bg-gradient-to-l from-slate-900 to-slate-950 border-l border-slate-800 flex items-center justify-center">
          <div className={`w-1.5 h-[80%] rounded-full transition-all duration-300 ${
            isAlert 
              ? "bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]" 
              : collisionRisk 
                ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse" 
                : "bg-slate-800"
          }`}></div>
        </div>

        {/* Warning Overlay shield */}
        {hp <= 0 && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center pointer-events-none z-20">
            <div className="bg-red-950/90 border border-red-500/40 rounded-xl px-5 py-3 text-center shadow-2xl text-red-500 text-sm font-extrabold uppercase tracking-widest animate-pulse flex flex-col items-center space-y-1">
              <span>⚠️ HARDWARE DEADLOCK ⚠️</span>
              <span className="text-[10px] text-red-400/80 font-normal normal-case font-mono">System frozen. Reset simulation.</span>
            </div>
          </div>
        )}

        {hp > 0 && isAlert && (
          <div className="absolute inset-0 bg-red-950/20 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-none z-20">
            <div className="bg-red-950/90 border border-red-500/50 rounded-xl px-4 py-2 text-center shadow-lg text-red-400 text-xs font-bold uppercase tracking-wider animate-bounce flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Emergency Halt Activated</span>
            </div>
          </div>
        )}
      </div>

      {/* Physics Spec Grid */}
      <div className="p-4 grid grid-cols-2 gap-3.5 bg-slate-950 border-t border-slate-900/60">
        
        {/* HP Bar */}
        <div className="flex flex-col space-y-1 bg-slate-900/35 border border-slate-900/50 p-2.5 rounded-lg">
          <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase text-slate-400">
            <span>Hardware Health</span>
            <span className={`font-bold ${hp > 50 ? "text-emerald-400" : hp > 20 ? "text-amber-400" : "text-red-500 animate-pulse"}`}>{hp} HP</span>
          </div>
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                hp > 50 
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                  : hp > 20 
                    ? "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]" 
                    : "bg-gradient-to-r from-red-650 to-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              }`}
              style={{ width: `${hp}%` }}
            ></div>
          </div>
        </div>

        {/* Battery Bar */}
        <div className="flex flex-col space-y-1 bg-slate-900/35 border border-slate-900/50 p-2.5 rounded-lg">
          <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase text-slate-400">
            <span>Battery Level</span>
            <span className={`font-bold ${battery > 50 ? "text-cyan-400" : battery > 15 ? "text-amber-400" : "text-red-500 animate-pulse"}`}>{battery.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div 
              className={`h-full transition-all duration-300 rounded-full ${
                battery > 50 
                  ? "bg-gradient-to-r from-cyan-500 to-indigo-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]" 
                  : battery > 15 
                    ? "bg-gradient-to-r from-amber-500 to-yellow-400" 
                    : "bg-red-500 animate-pulse"
              }`}
              style={{ width: `${battery}%` }}
            ></div>
          </div>
        </div>

        {/* Velocity Indicator */}
        <div className="bg-slate-900/35 border border-slate-900/50 p-2.5 rounded-lg flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono font-bold uppercase text-slate-500">Velocity</span>
            <span className="text-sm font-bold font-mono text-cyan-400 mt-0.5">{velocity.toFixed(2)} m/s</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            ({(velocity * 100).toFixed(0)} cm/s)
          </div>
        </div>

        {/* Temperature Indicator */}
        <div className={`bg-slate-900/35 border p-2.5 rounded-lg flex items-center justify-between transition-all ${
          temperature > 60 
            ? "border-red-500/30 bg-red-950/5 text-red-400 animate-pulse" 
            : "border-slate-900/50 text-slate-400"
        }`}>
          <div className="flex flex-col">
            <span className="text-[9px] font-mono font-bold uppercase text-slate-500">Core Temp</span>
            <span className={`text-sm font-bold font-mono mt-0.5 ${temperature > 60 ? "text-red-400" : "text-amber-400"}`}>
              {temperature.toFixed(0)}°C
            </span>
          </div>
          {temperature > 60 && (
            <span className="text-[9px] uppercase font-bold tracking-wider text-red-500 border border-red-500/20 px-1 py-0.5 rounded animate-bounce">
              Hot
            </span>
          )}
        </div>
      </div>

      {/* Latency Penalty & Braking Distance Indicator */}
      <div className="bg-slate-950 px-4 py-3.5 border-t border-slate-900 flex flex-col space-y-2">
        <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase text-slate-500">
          <span>Latency Braking Metric</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
            collisionRisk 
              ? "bg-red-500/10 border border-red-500/25 text-red-400 animate-pulse" 
              : "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
          }`}>
            {collisionRisk ? "CRITICAL COLLISION RISK" : "BRAKING THRESHOLD SAFE"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-slate-900/20 p-2 rounded border border-slate-900 flex flex-col justify-between">
            <span className="text-[9px] text-slate-500 uppercase">Est. Braking Dist</span>
            <span className={`font-bold mt-0.5 ${collisionRisk ? "text-red-400 font-black animate-pulse" : "text-cyan-400"}`}>
              {brakingDistance.toFixed(1)} cm
            </span>
          </div>
          <div className="bg-slate-900/20 p-2 rounded border border-slate-900 flex flex-col justify-between">
            <span className="text-[9px] text-slate-500 uppercase">Obstacle Gap</span>
            <span className="text-emerald-400 font-bold mt-0.5">
              {distance.toFixed(1)} cm
            </span>
          </div>
        </div>
        <div className="text-[9px] text-slate-600 font-mono leading-tight">
          * Calculated as: <code className="text-slate-400">Sliding Distance = Velocity ({velocity} m/s) × Latency ({latencyMs} ms)</code>. If sliding distance exceeds gap, hardware impact occurs!
        </div>
      </div>
      
    </div>
  );
}
