import { Play, Square, RotateCcw } from "lucide-react";
import type { CurrentUnit, ReactorPhase, TimeUnit } from "@/types/sample";
import { StatusBadge } from "./StatusBadge";

interface Props {
  status: ReactorPhase;
  timeUnit: TimeUnit;
  currentUnit: CurrentUnit;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onTimeUnitChange: (u: TimeUnit) => void;
  onCurrentUnitChange: (u: CurrentUnit) => void;
}

export function TestController({
  status, timeUnit, currentUnit,
  onStart, onStop, onClear,
  onTimeUnitChange, onCurrentUnitChange,
}: Props) {
  const isRunning = status === "ramp_up" || status === "decay";
  const canStart = status === "idle" || status === "completed";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
      <StatusBadge status={status} />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <UnitSelect
          label="Time"
          value={timeUnit}
          options={[["S", "Seconds"], ["MS", "Milliseconds"]]}
          onChange={(v) => onTimeUnitChange(v as TimeUnit)}
        />
        <UnitSelect
          label="Current"
          value={currentUnit}
          options={[["A", "Amperes"], ["mA", "Milliamps"]]}
          onChange={(v) => onCurrentUnitChange(v as CurrentUnit)}
        />

        <button
          onClick={onStart}
          disabled={!canStart}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Play className="h-4 w-4" /> Start Test
        </button>
        <button
          onClick={onStop}
          disabled={!isRunning || status === "decay"}
          className="inline-flex items-center gap-2 rounded-md bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-rose-500/30 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Square className="h-4 w-4" /> Stop Test
        </button>
        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-700"
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
      </div>
    </div>
  );
}

function UnitSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1.5 text-xs">
      <span className="font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-semibold text-slate-100 outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-slate-800">
            {l} ({v})
          </option>
        ))}
      </select>
    </label>
  );
}
