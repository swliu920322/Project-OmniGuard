"use client";

import React from "react";
import { KinematicParams, Mode, PRESETS, SliderConfig, SLIDERS } from "../lib/kinematic";

interface ParameterPanelProps {
  params: KinematicParams;
  mode: Mode;
  onChange: (key: keyof KinematicParams, value: number) => void;
  onLoadPreset?: (params: KinematicParams) => void;
}

function SliderRow({
  slider,
  value,
  onChange,
}: {
  slider: SliderConfig;
  value: number;
  onChange: (key: keyof KinematicParams, value: number) => void;
}) {
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-mono font-bold uppercase text-slate-400">
          {slider.label}
        </label>
        <span className="text-sm font-mono font-bold text-cyan-400">
          {value.toFixed(slider.step < 1 ? 1 : 0)} {slider.unit}
        </span>
      </div>
      <input
        type="range"
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={value}
        onChange={(e) => onChange(slider.key, Number(e.target.value))}
        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
      />
      <div className="flex justify-between text-[9px] text-slate-600 font-mono">
        <span>{slider.min}{slider.unit}</span>
        <span>{slider.max}{slider.unit}</span>
      </div>
    </div>
  );
}

export default function ParameterPanel({ params, mode, onChange, onLoadPreset }: ParameterPanelProps) {
  const physicalSliders = SLIDERS.filter((s) => s.category === "physical");
  const robotSliders = SLIDERS.filter((s) => s.category === "robot");
  const modeSliders = SLIDERS.filter((s) => s.category === mode);
  const isCloud = mode === "cloud";

  return (
    <div className="border border-slate-900 bg-slate-900/10 rounded-2xl p-5 md:p-6 shadow-lg backdrop-blur-sm space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider font-mono text-slate-500 font-bold">Parameters</h2>
        {onLoadPreset && (
          <select
            onChange={(e) => {
              const preset = PRESETS.find((p) => p.label === e.target.value);
              if (preset) onLoadPreset(preset.params);
            }}
            defaultValue=""
            className="bg-slate-950 border border-slate-800 text-slate-300 text-[10px] rounded px-2 py-1 font-mono focus:border-cyan-500 focus:outline-none"
          >
            <option value="" disabled>Presets</option>
            {PRESETS.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
        )}
      </div>

      <section className="space-y-4">
        <h3 className="text-[10px] uppercase font-mono font-bold text-emerald-500 flex items-center space-x-2">
          <span>🤖 Physical</span>
        </h3>
        <div className="space-y-5">
          {physicalSliders.map((slider) => (
            <SliderRow key={slider.key} slider={slider} value={params[slider.key]} onChange={onChange} />
          ))}
        </div>
      </section>

      {robotSliders.length > 0 && (
        <>
          <div className="border-t border-slate-900" />
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase font-mono font-bold text-emerald-500/70 flex items-center space-x-2">
              <span>⚙️ Robot</span>
            </h3>
            <div className="space-y-5">
              {robotSliders.map((slider) => (
                <SliderRow key={slider.key} slider={slider} value={params[slider.key]} onChange={onChange} />
              ))}
            </div>
          </section>
        </>
      )}

      <div className="border-t border-slate-900" />

      <section className="space-y-4">
        <h3 className={`text-[10px] uppercase font-mono font-bold flex items-center space-x-2 ${isCloud ? "text-indigo-400" : "text-cyan-400"}`}>
          <span>{isCloud ? "☁️ Cloud Control" : "⚡ Edge Control"}</span>
        </h3>
        <div className="space-y-5">
          {modeSliders.map((slider) => (
            <SliderRow key={slider.key} slider={slider} value={params[slider.key]} onChange={onChange} />
          ))}
        </div>
        {isCloud && (
          <div className="text-[9px] text-slate-600 font-mono leading-relaxed border border-slate-800 bg-slate-950/50 rounded-lg px-3 py-2">
            T<sub>cloud</sub> = RTT + (prompt + completion) / token_rate<br />
            <span className="text-slate-700">e.g. 800ms + (500+100) / 50 t/s ≈ 13s</span>
          </div>
        )}
      </section>
    </div>
  );
}
